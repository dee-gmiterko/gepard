import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../ipc/registry';
import { readJsonFile, writeJsonFile } from '../helpers/fs/jsonFile';
import { reviewJsonPath } from '../paths';
import {
  Comment,
  CommentDraft,
  generalCommentAnchor,
  LocalViewedState,
  ReviewThread,
} from '@gepard/common/ipc/schemas/comment';

const ReviewStoreFile = z.object({
  threads: z.array(ReviewThread),
  viewed: z.array(LocalViewedState),
  pendingReviewId: z.string().nullable().default(null),
  lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ReviewStoreFile = z.infer<typeof ReviewStoreFile>;

function emptyStore(): ReviewStoreFile {
  return { threads: [], viewed: [], pendingReviewId: null, lastSuccessfulSyncAt: null };
}

export function nowIso(): string {
  return new Date().toISOString();
}

function cloneStore(store: ReviewStoreFile): ReviewStoreFile {
  return structuredClone(store);
}

const cache = new Map<string, ReviewStoreFile>();
const cacheKey = (projectId: string, pr: number): string => `${projectId}:${pr}`;

const locks = new Map<string, Promise<unknown>>();

export function withReviewLock<T>(projectId: string, pr: number, fn: () => Promise<T>): Promise<T> {
  const key = cacheKey(projectId, pr);
  const settledPrior = (locks.get(key) ?? Promise.resolve()).then(
    () => undefined,
    () => undefined,
  );
  const result = settledPrior.then(fn);
  locks.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

async function readStoreFile(projectId: string, pr: number): Promise<ReviewStoreFile> {
  return readJsonFile(reviewJsonPath(projectId, pr), ReviewStoreFile, emptyStore);
}

export async function loadReview(projectId: string, pr: number): Promise<ReviewStoreFile> {
  const key = cacheKey(projectId, pr);
  const cached = cache.get(key);
  if (cached) return cloneStore(cached);
  const store = await readStoreFile(projectId, pr);
  cache.set(key, store);
  return cloneStore(store);
}

export async function saveReview(
  projectId: string,
  pr: number,
  store: ReviewStoreFile,
): Promise<void> {
  await writeJsonFile(reviewJsonPath(projectId, pr), store);
  cache.set(cacheKey(projectId, pr), cloneStore(store));
}

export async function listThreads(projectId: string, pr: number): Promise<ReviewThread[]> {
  const store = await loadReview(projectId, pr);
  return store.threads
    .filter((t) => t.local?.status !== 'deleted')
    .map((t) => ({ ...t, comments: t.comments.filter((c) => c.local?.status !== 'deleted') }))
    .filter((t) => t.comments.length > 0);
}

export interface UpsertContext {
  prId: string;
  commitOid: string;
}

export type CommentDraftInput = Omit<z.output<typeof CommentDraft>, 'projectId' | 'pr' | 'prId'>;

function findComment(
  store: ReviewStoreFile,
  commentId: string,
): { thread: ReviewThread; comment: Comment } | null {
  for (const thread of store.threads) {
    const comment = thread.comments.find((c) => c.id === commentId);
    if (comment) return { thread, comment };
  }
  return null;
}

async function upsertLocalCommentLocked(
  projectId: string,
  pr: number,
  ctx: UpsertContext,
  draft: CommentDraftInput,
): Promise<Comment> {
  const store = await loadReview(projectId, pr);
  const now = nowIso();

  if (draft.id !== null) {
    const found = findComment(store, draft.id);
    if (!found) throw new AppError('NOT_FOUND', `comment ${draft.id} not found`);
    const status = found.comment.local?.status;
    if (status === 'deleted' || found.thread.local?.status === 'deleted') {
      throw new AppError('NOT_EDITABLE', `comment ${draft.id} is marked for deletion`);
    }
    if (status === undefined && !found.comment.viewerDidAuthor) {
      throw new AppError('NOT_EDITABLE', `comment ${draft.id} can only be edited by its author`);
    }
    const nextStatus = status === 'new' ? 'new' : 'edited';
    found.comment.body = draft.body;
    found.comment.updatedAt = now;
    found.comment.local = { status: nextStatus, updatedAt: now, references: draft.references };
    await saveReview(projectId, pr, store);
    return found.comment;
  }

  if (draft.threadId !== null) {
    const thread = store.threads.find((t) => t.id === draft.threadId);
    if (!thread) throw new AppError('NOT_FOUND', `thread ${draft.threadId} not found`);
    const root = thread.comments[0];
    const comment: Comment = {
      id: randomUUID(),
      threadId: thread.id,
      reviewId: null,
      reviewState: null,
      author: null,
      body: draft.body,
      createdAt: now,
      updatedAt: now,
      lastEditedAt: null,
      replyToId: root?.id ?? null,
      outdated: false,
      viewerDidAuthor: true,
      viewerCanDelete: true,
      local: { status: 'new', updatedAt: now, references: draft.references },
    };
    thread.comments.push(comment);
    await saveReview(projectId, pr, store);
    return comment;
  }

  if (!draft.anchor && !draft.general) {
    throw new AppError('BAD_INPUT', 'a new thread needs an anchor');
  }
  const threadId = randomUUID();
  const comment: Comment = {
    id: randomUUID(),
    threadId,
    reviewId: null,
    reviewState: null,
    author: null,
    body: draft.body,
    createdAt: now,
    updatedAt: now,
    lastEditedAt: null,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: true,
    viewerCanDelete: true,
    local: { status: 'new', updatedAt: now, references: draft.references },
  };
  const thread: ReviewThread = {
    id: threadId,
    prId: ctx.prId,
    anchor: draft.anchor
      ? {
          path: draft.anchor.path,
          subjectType: draft.anchor.subjectType,
          side: draft.anchor.side,
          line: draft.anchor.line,
          startLine: draft.anchor.startLine,
          startSide: draft.anchor.startSide,
          originalLine: draft.anchor.line,
          originalStartLine: draft.anchor.startLine,
          commitOid: ctx.commitOid,
          originalCommitOid: ctx.commitOid,
        }
      : generalCommentAnchor(),
    isResolved: false,
    isOutdated: false,
    comments: [comment],
    local: { status: 'new', updatedAt: now },
  };
  store.threads.push(thread);
  await saveReview(projectId, pr, store);
  return comment;
}

export function upsertLocalComment(
  projectId: string,
  pr: number,
  ctx: UpsertContext,
  draft: CommentDraftInput,
): Promise<Comment> {
  return withReviewLock(projectId, pr, () => upsertLocalCommentLocked(projectId, pr, ctx, draft));
}

async function deleteLocalCommentLocked(
  projectId: string,
  pr: number,
  commentId: string,
): Promise<void> {
  const store = await loadReview(projectId, pr);
  const now = nowIso();
  const found = findComment(store, commentId);
  if (!found) throw new AppError('NOT_FOUND', `comment ${commentId} not found`);
  const { thread, comment } = found;
  const isRoot = thread.comments[0]?.id === commentId;

  if (isRoot) {
    if (thread.local?.status === 'new') {
      store.threads = store.threads.filter((t) => t.id !== thread.id);
    } else {
      const hasLiveReplies = thread.comments.some(
        (c) => c.id !== commentId && c.local?.status !== 'deleted',
      );
      if (hasLiveReplies) {
        throw new AppError(
          'NOT_DELETABLE',
          `comment ${commentId} is a thread root with replies and cannot be deleted`,
        );
      }
      if (!comment.viewerCanDelete) {
        throw new AppError('NOT_DELETABLE', `comment ${commentId} cannot be deleted`);
      }
      thread.local = { status: 'deleted', updatedAt: now };
    }
  } else if (comment.local?.status === 'new') {
    thread.comments = thread.comments.filter((c) => c.id !== commentId);
  } else {
    if (!comment.viewerCanDelete) {
      throw new AppError('NOT_DELETABLE', `comment ${commentId} cannot be deleted`);
    }
    comment.local = {
      status: 'deleted',
      updatedAt: now,
      references: comment.local?.references ?? [],
    };
  }
  await saveReview(projectId, pr, store);
}

export function deleteLocalComment(
  projectId: string,
  pr: number,
  commentId: string,
): Promise<void> {
  return withReviewLock(projectId, pr, () => deleteLocalCommentLocked(projectId, pr, commentId));
}

export async function listViewed(projectId: string, pr: number): Promise<LocalViewedState[]> {
  return (await loadReview(projectId, pr)).viewed;
}

export async function knownPrId(projectId: string, pr: number): Promise<string | null> {
  const store = await loadReview(projectId, pr);
  return store.viewed[0]?.prId ?? store.threads[0]?.prId ?? null;
}

async function setLocalViewedLocked(
  projectId: string,
  pr: number,
  prId: string,
  paths: string[],
  viewed: boolean,
): Promise<LocalViewedState[]> {
  const store = await loadReview(projectId, pr);
  const now = nowIso();
  for (const path of paths) {
    const row = store.viewed.find((v) => v.path === path);
    if (row) {
      row.viewed = viewed;
      row.localUpdatedAt = now;
    } else {
      store.viewed.push({
        prId,
        path,
        viewed,
        remote: null,
        localUpdatedAt: now,
        remoteFetchedAt: null,
      });
    }
  }
  await saveReview(projectId, pr, store);
  return store.viewed;
}

export function setLocalViewed(
  projectId: string,
  pr: number,
  prId: string,
  paths: string[],
  viewed: boolean,
): Promise<LocalViewedState[]> {
  return withReviewLock(projectId, pr, () =>
    setLocalViewedLocked(projectId, pr, prId, paths, viewed),
  );
}
