import { AppError } from '../ipc/registry'
import { log } from '../log'
import * as gh from './gh'
import * as git from './git'
import { ExecError } from './exec'
import * as review from '../store/review'
import { nowIso, withReviewLock, type ReviewStoreFile } from '../store/review'
import type {
  Comment,
  GqlIssueCommentRaw,
  GqlReviewCommentRaw,
  GqlReviewThreadRaw,
  LocalViewedState,
  RemoteViewedFile,
  ReviewThread
} from '@shared/ipc/schemas/comment'
import { generalCommentAnchor } from '@shared/ipc/schemas/comment'

function mapComment(raw: GqlReviewCommentRaw, threadId: string): Comment {
  return {
    id: raw.id,
    threadId,
    reviewId: raw.pullRequestReview?.id ?? null,
    reviewState: raw.pullRequestReview?.state ?? null,
    author: raw.author ? { login: raw.author.login } : { login: 'ghost' },
    body: raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastEditedAt: raw.lastEditedAt,
    replyToId: raw.replyTo?.id ?? null,
    outdated: raw.outdated,
    viewerDidAuthor: raw.viewerDidAuthor,
    viewerCanDelete: raw.viewerCanDelete
  }
}

function mapThread(raw: GqlReviewThreadRaw, prId: string): ReviewThread {
  const comments = raw.comments.nodes
    .map((c) => mapComment(c, raw.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    id: raw.id,
    prId,
    anchor: {
      path: raw.path,
      subjectType: raw.subjectType,
      side: raw.diffSide,
      line: raw.line,
      startLine: raw.startLine,
      startSide: raw.startDiffSide,
      originalLine: raw.originalLine,
      originalStartLine: raw.originalStartLine,
      commitOid: raw.comments.nodes[raw.comments.nodes.length - 1]?.commit?.oid ?? null,
      originalCommitOid: raw.comments.nodes[0]?.originalCommit?.oid ?? null
    },
    isResolved: raw.isResolved,
    isOutdated: raw.isOutdated,
    comments
  }
}

function mapGeneralComment(raw: GqlIssueCommentRaw, prId: string): ReviewThread {
  // A general PR comment has no thread of its own on GitHub.
  const comment: Comment = {
    id: raw.id,
    threadId: raw.id,
    reviewId: null,
    reviewState: null,
    author: raw.author ? { login: raw.author.login } : { login: 'ghost' },
    body: raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastEditedAt: raw.lastEditedAt,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: raw.viewerDidAuthor,
    viewerCanDelete: raw.viewerCanDelete
  }
  return {
    id: raw.id,
    prId,
    anchor: generalCommentAnchor(),
    isResolved: false,
    isOutdated: false,
    comments: [comment]
  }
}

function mergeOneThread(localThread: ReviewThread, remoteThread: ReviewThread): ReviewThread {
  const localById = new Map(localThread.comments.map((c) => [c.id, c]))
  const merged: Comment[] = []
  for (const c of localThread.comments)
    if (c.local?.status === 'new' || c.local?.status === 'edited') merged.push(c)
  for (const remoteComment of remoteThread.comments) {
    const localComment = localById.get(remoteComment.id)
    if (!localComment) {
      merged.push(remoteComment)
      continue
    }
    if (localComment.local?.status === 'new' || localComment.local?.status === 'edited') continue
    if (localComment.local?.status === 'deleted') {
      merged.push(localComment)
      continue
    }
    merged.push(remoteComment.updatedAt > localComment.updatedAt ? remoteComment : localComment)
  }
  merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    ...remoteThread,
    comments: merged,
    local: localThread.local?.status === 'deleted' ? localThread.local : undefined
  }
}

export function mergeThreads(local: ReviewThread[], remote: ReviewThread[]): ReviewThread[] {
  const localById = new Map(local.map((t) => [t.id, t]))
  const remoteById = new Map(remote.map((t) => [t.id, t]))
  const result: ReviewThread[] = []

  for (const t of local) if (t.local?.status === 'new') result.push(t)

  for (const [id, remoteThread] of remoteById) {
    const localThread = localById.get(id)
    result.push(localThread ? mergeOneThread(localThread, remoteThread) : remoteThread)
  }
  return result
}

export function mergeViewed(
  local: LocalViewedState[],
  remote: RemoteViewedFile[],
  prId: string,
  lastSuccessfulSyncAt: string | null
): LocalViewedState[] {
  const byPath = new Map(local.map((v) => [v.path, v]))
  const now = nowIso()
  for (const file of remote) {
    // GitHub's viewerViewedState also has a DISMISSED state.
    const remoteViewed = file.viewerViewedState === 'VIEWED'
    const existing = byPath.get(file.path)
    if (!existing) {
      byPath.set(file.path, {
        prId,
        path: file.path,
        viewed: remoteViewed,
        remote: file.viewerViewedState,
        localUpdatedAt: null,
        remoteFetchedAt: now
      })
      continue
    }
    const localWins =
      existing.localUpdatedAt !== null &&
      (lastSuccessfulSyncAt === null || existing.localUpdatedAt > lastSuccessfulSyncAt)
    existing.remote = file.viewerViewedState
    if (!localWins) {
      existing.viewed = remoteViewed
      existing.remoteFetchedAt = now
    }
  }
  return Array.from(byPath.values())
}

function isViewedDirty(v: LocalViewedState): boolean {
  return (
    v.localUpdatedAt !== null &&
    (v.remoteFetchedAt === null || v.localUpdatedAt > v.remoteFetchedAt)
  )
}

async function pushViewed(store: ReviewStoreFile, prId: string): Promise<number> {
  const now = nowIso()
  const dirty = store.viewed.filter(isViewedDirty)
  if (dirty.length === 0) return 0
  await gh.setFilesViewed(
    prId,
    dirty.map((v) => ({ path: v.path, viewed: v.viewed }))
  )
  for (const v of dirty) {
    v.remote = v.viewed ? 'VIEWED' : 'UNVIEWED'
    v.remoteFetchedAt = now
  }
  return dirty.length
}

export function composeBody(comment: Comment): string {
  const refs = comment.local?.references ?? []
  if (refs.length === 0) return comment.body
  const lines = [...new Set(refs.map((r) => `${r.path}:${r.line}`))]
  return `${comment.body}\n\n${lines.join('\n')}`
}

// GitHub errors a mutation on a comment someone else already deleted with a
// GraphQL NOT_FOUND partial error rather than a benign no-op. `gh api
// graphql` exits non-zero on that response and prints "gh: <message>
// (<type>)" to stderr, so the failure surfaces as an ExecError before any
// JSON body is parsed.
function isRemoteNotFoundError(e: unknown): boolean {
  return e instanceof ExecError && /\(NOT_FOUND\)/.test(e.stderr)
}

interface PushOutcome {
  pushedCount: number
  goneRemotely: number
}

// GitHub deletes and edits review comments without a pending review.
async function pushDeletions(
  projectId: string,
  pr: number,
  store: ReviewStoreFile
): Promise<PushOutcome> {
  let pushedCount = 0
  let goneRemotely = 0
  for (const thread of [...store.threads]) {
    const isGeneral = thread.anchor.subjectType === 'PR'
    if (thread.local?.status === 'deleted') {
      const root = thread.comments[0]
      if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`)
      try {
        if (isGeneral) await gh.deleteGeneralComment(root.id)
        else await gh.deleteReviewComment(root.id)
        pushedCount++
      } catch (e) {
        if (!isRemoteNotFoundError(e)) throw e
        goneRemotely++
      }
      store.threads = store.threads.filter((t) => t.id !== thread.id)
      await review.saveReview(projectId, pr, store)
      continue
    }
    for (const comment of [...thread.comments]) {
      if (comment.local?.status !== 'deleted') continue
      try {
        if (isGeneral) await gh.deleteGeneralComment(comment.id)
        else await gh.deleteReviewComment(comment.id)
        pushedCount++
      } catch (e) {
        if (!isRemoteNotFoundError(e)) throw e
        goneRemotely++
      }
      thread.comments = thread.comments.filter((c) => c.id !== comment.id)
      await review.saveReview(projectId, pr, store)
    }
  }
  return { pushedCount, goneRemotely }
}

async function pushEdits(
  projectId: string,
  pr: number,
  store: ReviewStoreFile
): Promise<PushOutcome> {
  let pushedCount = 0
  let goneRemotely = 0
  for (const thread of [...store.threads]) {
    const isGeneral = thread.anchor.subjectType === 'PR'
    for (const comment of [...thread.comments]) {
      if (comment.local?.status !== 'edited') continue
      const body = composeBody(comment)
      try {
        const result = isGeneral
          ? await gh.updateGeneralComment(comment.id, body)
          : await gh.updateReviewComment(comment.id, body)
        comment.body = body
        comment.updatedAt = result.updatedAt
        comment.lastEditedAt = result.lastEditedAt
        comment.local = undefined
        pushedCount++
      } catch (e) {
        if (!isRemoteNotFoundError(e)) throw e
        goneRemotely++
        if (thread.comments[0]?.id === comment.id) {
          store.threads = store.threads.filter((t) => t.id !== thread.id)
        } else {
          thread.comments = thread.comments.filter((c) => c.id !== comment.id)
        }
      }
      await review.saveReview(projectId, pr, store)
    }
  }
  return { pushedCount, goneRemotely }
}

// GitHub's IssueComment (a general PR comment) has no reply target: unlike a
// review thread, there is nothing on GitHub's side to nest a reply under.
// A locally-drafted "reply" to a general comment is only a local grouping
// convenience, so once pushed it becomes its own independent, top-level PR
// comment - exactly like a fresh general comment.
export function collectPendingGeneralReplies(
  threads: ReviewThread[]
): { thread: ReviewThread; comment: Comment }[] {
  const pending: { thread: ReviewThread; comment: Comment }[] = []
  for (const thread of threads) {
    if (thread.anchor.subjectType !== 'PR') continue
    const root = thread.comments[0]
    for (const comment of thread.comments) {
      if (comment === root || comment.local?.status !== 'new') continue
      pending.push({ thread, comment })
    }
  }
  return pending
}

// General PR comments post immediately, with no pending review to batch
// them into, unlike a new review thread.
async function pushGeneralComments(
  projectId: string,
  pr: number,
  store: ReviewStoreFile,
  prId: string
): Promise<number> {
  let pushedCount = 0
  for (const thread of store.threads) {
    if (thread.anchor.subjectType !== 'PR' || thread.local?.status !== 'new') continue
    const root = thread.comments[0]
    if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`)
    const body = composeBody(root)
    const result = await gh.addGeneralComment(prId, body)
    const oldThreadId = thread.id
    thread.id = result.id
    thread.local = undefined
    root.id = result.id
    root.threadId = thread.id
    root.createdAt = result.createdAt
    root.updatedAt = result.updatedAt
    root.body = body
    root.local = undefined
    for (const c of thread.comments) {
      if (c.threadId === oldThreadId) c.threadId = thread.id
    }
    pushedCount++
    await review.saveReview(projectId, pr, store)
  }

  for (const { thread, comment } of collectPendingGeneralReplies(store.threads)) {
    const body = composeBody(comment)
    const result = await gh.addGeneralComment(prId, body)
    comment.id = result.id
    comment.createdAt = result.createdAt
    comment.updatedAt = result.updatedAt
    comment.body = body
    comment.local = undefined
    thread.comments = thread.comments.filter((c) => c !== comment)
    pushedCount++
    await review.saveReview(projectId, pr, store)
  }

  return pushedCount
}

export interface PendingGroup {
  commitOid: string
  newThreads: ReviewThread[]
  replies: { thread: ReviewThread; comment: Comment }[]
}

// GitHub reads a LEFT-side line against the PR base, never against the
// immediate parent of the commit a review happens to be pinned to.
function assertLeftAnchorAgainstBase(thread: ReviewThread, headRefOid: string): void {
  if (thread.anchor.side !== 'LEFT') return
  const commitOid = thread.anchor.commitOid ?? headRefOid
  if (commitOid !== headRefOid) {
    throw new AppError(
      'UNSUPPORTED_LEFT_ANCHOR',
      `cannot push the LEFT-side comment on ${thread.anchor.path} anchored to commit ${commitOid}: ` +
        "GitHub reads LEFT-side lines against the PR base, not a single commit's parent"
    )
  }
}

// A GitHub review is pinned to a single commit.
export function groupPendingByCommit(threads: ReviewThread[], headRefOid: string): PendingGroup[] {
  const groups = new Map<string, PendingGroup>()
  const groupFor = (commitOid: string | null): PendingGroup => {
    const key = commitOid ?? headRefOid
    let g = groups.get(key)
    if (!g) {
      g = { commitOid: key, newThreads: [], replies: [] }
      groups.set(key, g)
    }
    return g
  }
  for (const thread of threads) {
    if (thread.local?.status === 'new') {
      assertLeftAnchorAgainstBase(thread, headRefOid)
      groupFor(thread.anchor.commitOid).newThreads.push(thread)
    }
    const root = thread.comments[0]
    for (const comment of thread.comments) {
      if (comment === root || comment.local?.status !== 'new') continue
      groupFor(thread.anchor.commitOid).replies.push({ thread, comment })
    }
  }
  return Array.from(groups.values())
}

async function ensureOwnPendingReview(
  projectId: string,
  pr: number,
  store: ReviewStoreFile,
  owner: string,
  repo: string,
  prNumber: number,
  prId: string,
  commitOid: string
): Promise<string> {
  const existing = await gh.findPendingReview(owner, repo, prNumber)
  if (existing) {
    if (store.pendingReviewId !== existing.id) {
      store.pendingReviewId = existing.id
      await review.saveReview(projectId, pr, store)
    }
    return existing.id
  }
  const reviewId = await gh.createPendingReview(prId, commitOid)
  store.pendingReviewId = reviewId
  await review.saveReview(projectId, pr, store)
  return reviewId
}

async function pushGroup(
  projectId: string,
  pr: number,
  owner: string,
  repo: string,
  prNumber: number,
  store: ReviewStoreFile,
  prId: string,
  group: PendingGroup
): Promise<number> {
  let pushedCount = 0
  const reviewId = await ensureOwnPendingReview(
    projectId,
    pr,
    store,
    owner,
    repo,
    prNumber,
    prId,
    group.commitOid
  )

  for (const thread of group.newThreads) {
    const root = thread.comments[0]
    if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`)
    const body = composeBody(root)
    const result = await gh.addReviewThread({
      pullRequestReviewId: reviewId,
      path: thread.anchor.path,
      body,
      line: thread.anchor.line,
      side: thread.anchor.side,
      startLine: thread.anchor.startLine,
      startSide: thread.anchor.startSide
    })
    const oldThreadId = thread.id
    const oldRootId = root.id
    thread.id = result.thread.id
    if (result.isFile) thread.anchor.subjectType = 'FILE'
    thread.anchor.line = result.thread.line
    thread.anchor.startLine = result.thread.startLine
    thread.isResolved = result.thread.isResolved
    thread.local = undefined
    root.id = result.rootComment.id
    root.threadId = thread.id
    root.reviewId = result.rootComment.pullRequestReview?.id ?? reviewId
    root.reviewState = result.rootComment.pullRequestReview?.state ?? 'PENDING'
    root.createdAt = result.rootComment.createdAt
    root.updatedAt = result.rootComment.updatedAt
    root.body = body
    root.local = undefined
    for (const c of thread.comments) {
      if (c.threadId === oldThreadId) c.threadId = thread.id
      if (c.replyToId === oldRootId) c.replyToId = root.id
    }
    pushedCount++
  }

  for (const { thread, comment } of group.replies) {
    const root = thread.comments[0]
    const body = composeBody(comment)
    const result = await gh.addReviewThreadReply(thread.id, body, reviewId)
    comment.id = result.id
    comment.threadId = thread.id
    comment.reviewId = result.pullRequestReview?.id ?? reviewId
    comment.reviewState = result.pullRequestReview?.state ?? 'PENDING'
    comment.createdAt = result.createdAt
    comment.updatedAt = result.updatedAt
    comment.body = body
    comment.replyToId = result.replyTo?.id ?? root?.id ?? null
    comment.local = undefined
    pushedCount++
  }

  await gh.submitReview(reviewId)
  store.pendingReviewId = null
  return pushedCount
}

async function pushComments(
  projectId: string,
  pr: number,
  owner: string,
  repo: string,
  prNumber: number,
  store: ReviewStoreFile,
  prId: string,
  headRefOid: string
): Promise<PushOutcome> {
  let pushedCount = 0
  let goneRemotely = 0
  const deletions = await pushDeletions(projectId, pr, store)
  pushedCount += deletions.pushedCount
  goneRemotely += deletions.goneRemotely
  const edits = await pushEdits(projectId, pr, store)
  pushedCount += edits.pushedCount
  goneRemotely += edits.goneRemotely

  pushedCount += await pushGeneralComments(projectId, pr, store, prId)

  const reviewThreads = store.threads.filter((t) => t.anchor.subjectType !== 'PR')
  const groups = groupPendingByCommit(reviewThreads, headRefOid)
  for (const group of groups) {
    pushedCount += await pushGroup(projectId, pr, owner, repo, prNumber, store, prId, group)
  }
  return { pushedCount, goneRemotely }
}

export function countPendingChanges(store: ReviewStoreFile): number {
  let count = 0
  for (const thread of store.threads) {
    if (thread.local?.status === 'new') count += 1
    if (thread.local?.status === 'deleted') {
      count += 1
      continue
    }
    const root = thread.comments[0]
    for (const comment of thread.comments) {
      if (comment === root) continue
      if (comment.local?.status === 'new' || comment.local?.status === 'deleted') count += 1
    }
  }
  for (const thread of store.threads) {
    for (const comment of thread.comments) {
      if (comment.local?.status === 'edited') count += 1
    }
  }
  return count + store.viewed.filter(isViewedDirty).length
}

export interface SyncResult {
  syncedAt: string
  droppedRemoteDeleted: number
}

export interface SyncContext {
  owner: string
  repo: string
}

async function runSyncLocked(
  projectId: string,
  pr: number,
  mode: 'full' | 'pull',
  ctx: SyncContext
): Promise<SyncResult> {
  log.info('sync', `projectId=${projectId} pr=${pr} mode=${mode} start`)
  const store = await review.loadReview(projectId, pr)

  const { id: prId, headRefOid, baseRefOid } = await gh.viewPr(ctx.owner, ctx.repo, pr)

  await git.fetchOrigin(projectId)
  const { head: currentHead } = await git.workingTree(projectId)
  if (currentHead !== headRefOid) {
    await git.checkoutTarget(projectId, { kind: 'pr', pr, headRefOid, baseRefOid })
  }

  let pushedViewed = 0
  let pushedComments = 0
  let goneRemotely = 0
  if (mode === 'full') {
    try {
      pushedViewed = await pushViewed(store, prId)
      const commentsOutcome = await pushComments(
        projectId,
        pr,
        ctx.owner,
        ctx.repo,
        pr,
        store,
        prId,
        headRefOid
      )
      pushedComments = commentsOutcome.pushedCount
      goneRemotely = commentsOutcome.goneRemotely
    } finally {
      await review.saveReview(projectId, pr, store)
    }
    if (goneRemotely > 0) {
      log.warn(
        'sync',
        `projectId=${projectId} pr=${pr} dropped ${goneRemotely} local pending change(s) ` +
          `already deleted on GitHub`
      )
    }
  }

  const [threadsResult, generalResult, viewedResult] = await Promise.all([
    gh.fetchReviewThreads(ctx.owner, ctx.repo, pr),
    gh.fetchGeneralComments(ctx.owner, ctx.repo, pr),
    gh.fetchViewedFiles(ctx.owner, ctx.repo, pr)
  ])
  const remoteThreads = [
    ...threadsResult.threads.map((t) => mapThread(t, threadsResult.prId)),
    ...generalResult.comments.map((c) => mapGeneralComment(c, generalResult.prId))
  ]
  const mergedThreads = mergeThreads(store.threads, remoteThreads)
  const mergedViewed = mergeViewed(
    store.viewed,
    viewedResult.files,
    threadsResult.prId,
    store.lastSuccessfulSyncAt
  )

  const syncedAt = nowIso()
  const finalStore: ReviewStoreFile = {
    threads: mergedThreads,
    viewed: mergedViewed,
    pendingReviewId: store.pendingReviewId,
    lastSuccessfulSyncAt: mode === 'full' ? syncedAt : store.lastSuccessfulSyncAt
  }
  await review.saveReview(projectId, pr, finalStore)
  log.info(
    'sync',
    `projectId=${projectId} pr=${pr} mode=${mode} end ` +
      `pushed=${pushedViewed + pushedComments} pulledThreads=${remoteThreads.length} ` +
      `pulledViewed=${viewedResult.files.length}`
  )
  return { syncedAt, droppedRemoteDeleted: goneRemotely }
}

export async function runSync(
  projectId: string,
  pr: number,
  mode: 'full' | 'pull',
  ctx: SyncContext
): Promise<SyncResult> {
  return withReviewLock(projectId, pr, () => runSyncLocked(projectId, pr, mode, ctx))
}
