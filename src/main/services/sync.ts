import { AppError } from '../ipc/registry'
import { log } from '../log'
import * as gh from './gh'
import * as review from '../store/review'
import { nowIso, type ReviewStoreFile } from '../store/review'
import type {
  Comment,
  GqlReviewCommentRaw,
  GqlReviewThreadRaw,
  LocalViewedState,
  RemoteViewedFile,
  ReviewThread
} from '@shared/ipc/schemas/comment'

function mapComment(raw: GqlReviewCommentRaw, threadId: string): Comment {
  return {
    id: raw.id,
    databaseId: raw.databaseId,
    threadId,
    reviewId: raw.pullRequestReview?.id ?? null,
    reviewState: raw.pullRequestReview?.state ?? null,
    author: raw.author
      ? { login: raw.author.login, isBot: false }
      : { login: 'ghost', isBot: false },
    body: raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastEditedAt: raw.lastEditedAt,
    replyToId: raw.replyTo?.id ?? null,
    url: raw.url,
    outdated: raw.outdated,
    viewerDidAuthor: raw.viewerDidAuthor,
    viewerCanDelete: raw.viewerCanDelete
  }
}

function mapThread(raw: GqlReviewThreadRaw, prId: string): ReviewThread {
  const nodes = raw.comments.nodes
  const comments = nodes
    .map((c) => mapComment(c, raw.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const remoteUpdatedAt = comments.reduce(
    (max, c) => (c.updatedAt > max ? c.updatedAt : max),
    comments[0]?.updatedAt ?? nowIso()
  )
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
      commitOid: nodes[nodes.length - 1]?.commit?.oid ?? null,
      originalCommitOid: nodes[0]?.originalCommit?.oid ?? null
    },
    isResolved: raw.isResolved,
    isOutdated: raw.isOutdated,
    comments,
    remoteUpdatedAt
  }
}

function mergeOneThread(localThread: ReviewThread, remoteThread: ReviewThread): ReviewThread {
  const localById = new Map(localThread.comments.map((c) => [c.id, c]))
  const merged: Comment[] = []
  for (const c of localThread.comments) if (c.local?.status === 'new') merged.push(c)
  for (const remoteComment of remoteThread.comments) {
    const localComment = localById.get(remoteComment.id)
    if (!localComment) {
      merged.push(remoteComment)
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
    // GitHub's viewerViewedState has a third state, DISMISSED, which is
    // treated as not-viewed here, same as UNVIEWED.
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

function hasPendingComments(store: ReviewStoreFile): boolean {
  return store.threads.some(
    (t) =>
      t.local?.status === 'new' || t.local?.status === 'deleted' || t.comments.some((c) => c.local)
  )
}

async function pushComments(
  owner: string,
  repo: string,
  prNumber: number,
  store: ReviewStoreFile,
  prId: string,
  headRefOid: string
): Promise<number> {
  if (!hasPendingComments(store)) return 0
  let pushedCount = 0

  const reviewId = await gh.ensurePendingReview(owner, repo, prNumber, prId, headRefOid)

  for (const thread of store.threads) {
    if (thread.local?.status !== 'new') continue
    const root = thread.comments[0]
    if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`)
    const result = await gh.addReviewThread({
      pullRequestReviewId: reviewId,
      path: thread.anchor.path,
      body: composeBody(root),
      line: thread.anchor.line,
      side: thread.anchor.side,
      startLine: thread.anchor.startLine,
      startSide: thread.anchor.startSide
    })
    const oldThreadId = thread.id
    thread.id = result.thread.id
    if (result.isFile) thread.anchor.subjectType = 'FILE'
    thread.anchor.line = result.thread.line
    thread.anchor.startLine = result.thread.startLine
    thread.isResolved = result.thread.isResolved
    thread.local = undefined
    root.id = result.rootComment.id
    root.databaseId = result.rootComment.databaseId
    root.threadId = thread.id
    root.reviewId = result.rootComment.pullRequestReview?.id ?? reviewId
    root.reviewState = result.rootComment.pullRequestReview?.state ?? 'PENDING'
    root.createdAt = result.rootComment.createdAt
    root.updatedAt = result.rootComment.updatedAt
    root.url = result.rootComment.url
    root.local = undefined
    for (const c of thread.comments) {
      if (c.threadId === oldThreadId) c.threadId = thread.id
      if (c.replyToId === oldThreadId) c.replyToId = thread.id
    }
    pushedCount++
  }

  for (const thread of store.threads) {
    const root = thread.comments[0]
    for (const comment of thread.comments) {
      if (comment === root || comment.local?.status !== 'new') continue
      const result = await gh.addReviewThreadReply(thread.id, composeBody(comment), reviewId)
      comment.id = result.id
      comment.databaseId = result.databaseId
      comment.threadId = thread.id
      comment.reviewId = result.pullRequestReview?.id ?? reviewId
      comment.reviewState = result.pullRequestReview?.state ?? 'PENDING'
      comment.createdAt = result.createdAt
      comment.updatedAt = result.updatedAt
      comment.url = result.url
      comment.replyToId = result.replyTo?.id ?? root?.id ?? null
      comment.local = undefined
      pushedCount++
    }
  }

  // GitHub refuses to delete a thread root that has replies unless you're an
  // admin, so that thread is left pending locally when it happens.
  const remainingThreads: ReviewThread[] = []
  for (const thread of store.threads) {
    if (thread.local?.status === 'deleted') {
      const root = thread.comments[0]
      if (root?.viewerCanDelete) {
        await gh.deleteReviewComment(root.id)
        pushedCount++
        continue
      }
      remainingThreads.push(thread)
      continue
    }
    const kept: Comment[] = []
    for (const comment of thread.comments) {
      if (comment.local?.status === 'deleted' && comment.viewerCanDelete) {
        await gh.deleteReviewComment(comment.id)
        pushedCount++
        continue
      }
      kept.push(comment)
    }
    thread.comments = kept
    remainingThreads.push(thread)
  }
  store.threads = remainingThreads

  await gh.submitReview(reviewId)
  return pushedCount
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
  return count + store.viewed.filter(isViewedDirty).length
}

export interface SyncResult {
  syncedAt: string
}

export interface SyncContext {
  owner: string
  repo: string
}

export async function runSync(
  projectId: string,
  pr: number,
  mode: 'full' | 'pull',
  ctx: SyncContext
): Promise<SyncResult> {
  log.info('sync', `projectId=${projectId} pr=${pr} mode=${mode} start`)
  const store = await review.loadReview(projectId, pr)

  const { id: prId, headRefOid } = await gh.viewPr(ctx.owner, ctx.repo, pr)

  let pushedViewed = 0
  let pushedComments = 0
  if (mode === 'full') {
    try {
      pushedViewed = await pushViewed(store, prId)
      pushedComments = await pushComments(ctx.owner, ctx.repo, pr, store, prId, headRefOid)
    } finally {
      await review.saveReview(projectId, pr, store)
    }
  }

  const [threadsResult, viewedResult] = await Promise.all([
    gh.fetchReviewThreads(ctx.owner, ctx.repo, pr),
    gh.fetchViewedFiles(ctx.owner, ctx.repo, pr)
  ])
  const remoteThreads = threadsResult.threads.map((t) => mapThread(t, threadsResult.prId))
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
    lastSuccessfulSyncAt: mode === 'full' ? syncedAt : store.lastSuccessfulSyncAt
  }
  await review.saveReview(projectId, pr, finalStore)
  log.info(
    'sync',
    `projectId=${projectId} pr=${pr} mode=${mode} end ` +
      `pushed=${pushedViewed + pushedComments} pulledThreads=${remoteThreads.length} ` +
      `pulledViewed=${viewedResult.files.length}`
  )
  return { syncedAt }
}
