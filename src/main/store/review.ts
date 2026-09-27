import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { AppError } from '../ipc/registry'
import { projectReviewDir, reviewJsonPath } from '../paths'
import { Comment, CommentDraft, LocalViewedState, ReviewThread } from '@shared/ipc/schemas/comment'

const ReviewStoreFile = z.object({
  threads: z.array(ReviewThread),
  viewed: z.array(LocalViewedState),
  lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable()
})
export type ReviewStoreFile = z.infer<typeof ReviewStoreFile>

function emptyStore(): ReviewStoreFile {
  return { threads: [], viewed: [], lastSuccessfulSyncAt: null }
}

export function nowIso(): string {
  return new Date().toISOString()
}

const cache = new Map<string, ReviewStoreFile>()
const cacheKey = (projectId: string, pr: number): string => `${projectId}:${pr}`

async function readStoreFile(projectId: string, pr: number): Promise<ReviewStoreFile> {
  let raw: string
  try {
    raw = await readFile(reviewJsonPath(projectId, pr), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore()
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (e) {
    throw new AppError(
      'STORE_CORRUPT',
      `review/${pr}.json for ${projectId} is not valid JSON: ${(e as Error).message}`
    )
  }
  const parsed = ReviewStoreFile.safeParse(json)
  if (!parsed.success) {
    throw new AppError(
      'STORE_CORRUPT',
      `review/${pr}.json for ${projectId} is invalid: ${z.prettifyError(parsed.error)}`
    )
  }
  return parsed.data
}

export async function loadReview(projectId: string, pr: number): Promise<ReviewStoreFile> {
  const key = cacheKey(projectId, pr)
  const cached = cache.get(key)
  if (cached) return cached
  const store = await readStoreFile(projectId, pr)
  cache.set(key, store)
  return store
}

// Write tmp -> rename: POSIX rename is atomic, so a crash mid-write never
// leaves a corrupt file; then refresh the in-memory copy.
export async function saveReview(
  projectId: string,
  pr: number,
  store: ReviewStoreFile
): Promise<void> {
  const dir = projectReviewDir(projectId)
  await mkdir(dir, { recursive: true })
  const tmpPath = join(dir, `.${pr}.json.${randomUUID()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(store, null, 2) + '\n', 'utf8')
  await rename(tmpPath, reviewJsonPath(projectId, pr))
  cache.set(cacheKey(projectId, pr), store)
}

export async function listThreads(projectId: string, pr: number): Promise<ReviewThread[]> {
  const store = await loadReview(projectId, pr)
  return store.threads
    .filter((t) => t.local?.status !== 'deleted')
    .map((t) => ({ ...t, comments: t.comments.filter((c) => c.local?.status !== 'deleted') }))
    .filter((t) => t.comments.length > 0)
}

export interface UpsertContext {
  prId: string
  headRefOid: string
  viewerLogin: string
}

export type CommentDraftInput = Omit<z.output<typeof CommentDraft>, 'projectId' | 'pr'>

function findComment(
  store: ReviewStoreFile,
  commentId: string
): { thread: ReviewThread; comment: Comment } | null {
  for (const thread of store.threads) {
    const comment = thread.comments.find((c) => c.id === commentId)
    if (comment) return { thread, comment }
  }
  return null
}

export async function upsertLocalComment(
  projectId: string,
  pr: number,
  ctx: UpsertContext,
  draft: CommentDraftInput
): Promise<Comment> {
  const store = await loadReview(projectId, pr)
  const now = nowIso()

  if (draft.id !== null) {
    const found = findComment(store, draft.id)
    if (!found) throw new AppError('NOT_FOUND', `comment ${draft.id} not found`)
    if (found.comment.local?.status !== 'new') {
      throw new AppError(
        'NOT_EDITABLE',
        `comment ${draft.id} is already synced and cannot be edited locally`
      )
    }
    found.comment.body = draft.body
    found.comment.updatedAt = now
    found.comment.local = { status: 'new', updatedAt: now, references: draft.references }
    await saveReview(projectId, pr, store)
    return found.comment
  }

  if (draft.threadId !== null) {
    const thread = store.threads.find((t) => t.id === draft.threadId)
    if (!thread) throw new AppError('NOT_FOUND', `thread ${draft.threadId} not found`)
    const root = thread.comments[0]
    const comment: Comment = {
      id: `local:${randomUUID()}`,
      databaseId: null,
      threadId: thread.id,
      reviewId: null,
      reviewState: null,
      author: { login: ctx.viewerLogin, isBot: false },
      body: draft.body,
      createdAt: now,
      updatedAt: now,
      lastEditedAt: null,
      replyToId: root?.id ?? null,
      url: null,
      outdated: false,
      viewerDidAuthor: true,
      viewerCanDelete: true,
      local: { status: 'new', updatedAt: now, references: draft.references }
    }
    thread.comments.push(comment)
    await saveReview(projectId, pr, store)
    return comment
  }

  if (!draft.anchor) throw new AppError('BAD_INPUT', 'a new thread needs an anchor')
  const threadId = `local:${randomUUID()}`
  const comment: Comment = {
    id: `local:${randomUUID()}`,
    databaseId: null,
    threadId,
    reviewId: null,
    reviewState: null,
    author: { login: ctx.viewerLogin, isBot: false },
    body: draft.body,
    createdAt: now,
    updatedAt: now,
    lastEditedAt: null,
    replyToId: null,
    url: null,
    outdated: false,
    viewerDidAuthor: true,
    viewerCanDelete: true,
    local: { status: 'new', updatedAt: now, references: draft.references }
  }
  const thread: ReviewThread = {
    id: threadId,
    prId: ctx.prId,
    anchor: {
      path: draft.anchor.path,
      subjectType: draft.anchor.subjectType,
      side: draft.anchor.side,
      line: draft.anchor.line,
      startLine: draft.anchor.startLine,
      startSide: draft.anchor.startSide,
      originalLine: draft.anchor.line,
      originalStartLine: draft.anchor.startLine,
      commitOid: ctx.headRefOid,
      originalCommitOid: ctx.headRefOid
    },
    isResolved: false,
    isOutdated: false,
    comments: [comment],
    remoteUpdatedAt: now,
    local: { status: 'new', updatedAt: now }
  }
  store.threads.push(thread)
  await saveReview(projectId, pr, store)
  return comment
}

// GitHub refuses to delete the root of a thread that has replies for
// non-admins, so deleting a thread's root here only marks the whole thread
// `deleted` locally; Sync surfaces GitHub's failure when it pushes that.
export async function deleteLocalComment(
  projectId: string,
  pr: number,
  commentId: string
): Promise<void> {
  const store = await loadReview(projectId, pr)
  const now = nowIso()
  const found = findComment(store, commentId)
  if (!found) throw new AppError('NOT_FOUND', `comment ${commentId} not found`)
  const { thread, comment } = found
  const isRoot = thread.comments[0]?.id === commentId

  if (isRoot) {
    if (thread.local?.status === 'new') {
      store.threads = store.threads.filter((t) => t.id !== thread.id)
    } else {
      thread.local = { status: 'deleted', updatedAt: now }
    }
  } else if (comment.local?.status === 'new') {
    thread.comments = thread.comments.filter((c) => c.id !== commentId)
  } else {
    comment.local = {
      status: 'deleted',
      updatedAt: now,
      references: comment.local?.references ?? []
    }
  }
  await saveReview(projectId, pr, store)
}

export async function listViewed(projectId: string, pr: number): Promise<LocalViewedState[]> {
  return (await loadReview(projectId, pr)).viewed
}

export async function knownPrId(projectId: string, pr: number): Promise<string | null> {
  const store = await loadReview(projectId, pr)
  return store.viewed[0]?.prId ?? store.threads[0]?.prId ?? null
}

export async function setLocalViewed(
  projectId: string,
  pr: number,
  prId: string,
  paths: string[],
  viewed: boolean
): Promise<LocalViewedState[]> {
  const store = await loadReview(projectId, pr)
  const now = nowIso()
  for (const path of paths) {
    const row = store.viewed.find((v) => v.path === path)
    if (row) {
      row.viewed = viewed
      row.localUpdatedAt = now
    } else {
      store.viewed.push({
        prId,
        path,
        viewed,
        remote: null,
        localUpdatedAt: now,
        remoteFetchedAt: null
      })
    }
  }
  await saveReview(projectId, pr, store)
  return store.viewed
}
