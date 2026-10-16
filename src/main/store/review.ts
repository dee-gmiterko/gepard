import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';
import type { Paths } from '../paths';
import type { FileLockService } from '../services/fileLock';
import {
  Comment,
  CommentDraft,
  generalCommentAnchor,
  LocalViewedState,
  ReviewThread,
  AppError,
} from '@gepard/common';

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

const cacheKey = (projectId: string, pr: number | null): string =>
  `${projectId}:${pr ?? 'unassigned'}`;

export const UNASSIGNED_PR_ID = 'unassigned';

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

export class ReviewStore {
  constructor(
    private readonly paths: Paths,
    private readonly locks: FileLockService,
  ) {}

  withReviewLock<T>(projectId: string, pr: number | null, fn: () => Promise<T>): Promise<T> {
    return this.locks.withLock(this.paths.writeLockPath(`review-${cacheKey(projectId, pr)}`), fn);
  }

  private async readStoreFile(projectId: string, pr: number | null): Promise<ReviewStoreFile> {
    return readJsonFile(this.paths.reviewJsonPath(projectId, pr), ReviewStoreFile, emptyStore);
  }

  async loadReview(projectId: string, pr: number | null): Promise<ReviewStoreFile> {
    return this.readStoreFile(projectId, pr);
  }

  async saveReview(projectId: string, pr: number | null, store: ReviewStoreFile): Promise<void> {
    await writeJsonFile(this.paths.reviewJsonPath(projectId, pr), store);
  }

  async listThreads(projectId: string, pr: number | null): Promise<ReviewThread[]> {
    const store = await this.loadReview(projectId, pr);
    return store.threads
      .filter((t) => t.local?.status !== 'deleted')
      .map((t) => ({ ...t, comments: t.comments.filter((c) => c.local?.status !== 'deleted') }))
      .filter((t) => t.comments.length > 0);
  }

  private async upsertLocalCommentLocked(
    projectId: string,
    pr: number | null,
    ctx: UpsertContext,
    draft: CommentDraftInput,
  ): Promise<Comment> {
    const store = await this.loadReview(projectId, pr);
    const now = new Date().toISOString();

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
      await this.saveReview(projectId, pr, store);
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
      await this.saveReview(projectId, pr, store);
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
    await this.saveReview(projectId, pr, store);
    return comment;
  }

  upsertLocalComment(
    projectId: string,
    pr: number | null,
    ctx: UpsertContext,
    draft: CommentDraftInput,
  ): Promise<Comment> {
    return this.withReviewLock(projectId, pr, () =>
      this.upsertLocalCommentLocked(projectId, pr, ctx, draft),
    );
  }

  private async deleteLocalCommentLocked(
    projectId: string,
    pr: number | null,
    commentId: string,
  ): Promise<void> {
    const store = await this.loadReview(projectId, pr);
    const now = new Date().toISOString();
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
    await this.saveReview(projectId, pr, store);
  }

  deleteLocalComment(projectId: string, pr: number | null, commentId: string): Promise<void> {
    return this.withReviewLock(projectId, pr, () =>
      this.deleteLocalCommentLocked(projectId, pr, commentId),
    );
  }

  clearUnassignedThreads(projectId: string, threadIds: string[]): Promise<void> {
    return this.withReviewLock(projectId, null, async () => {
      const store = await this.loadReview(projectId, null);
      const ids = new Set(threadIds);
      store.threads = store.threads.filter((t) => !ids.has(t.id));
      await this.saveReview(projectId, null, store);
    });
  }

  async listViewed(projectId: string, pr: number): Promise<LocalViewedState[]> {
    return (await this.loadReview(projectId, pr)).viewed;
  }

  async knownPrId(projectId: string, pr: number): Promise<string | null> {
    const store = await this.loadReview(projectId, pr);
    return store.viewed[0]?.prId ?? store.threads[0]?.prId ?? null;
  }

  private async setLocalViewedLocked(
    projectId: string,
    pr: number,
    prId: string,
    paths: string[],
    viewed: boolean,
    sha: string | null,
  ): Promise<LocalViewedState[]> {
    const store = await this.loadReview(projectId, pr);
    const now = new Date().toISOString();
    for (const path of paths) {
      const row = store.viewed.find((v) => v.path === path);
      if (row) {
        row.viewed = viewed;
        row.localUpdatedAt = now;
        if (viewed && sha !== null) row.viewedSha = sha;
      } else {
        store.viewed.push({
          prId,
          path,
          viewed,
          remote: null,
          localUpdatedAt: now,
          remoteFetchedAt: null,
          viewedSha: viewed ? sha : null,
        });
      }
    }
    await this.saveReview(projectId, pr, store);
    return store.viewed;
  }

  setLocalViewed(
    projectId: string,
    pr: number,
    prId: string,
    paths: string[],
    viewed: boolean,
    sha: string | null = null,
  ): Promise<LocalViewedState[]> {
    return this.withReviewLock(projectId, pr, () =>
      this.setLocalViewedLocked(projectId, pr, prId, paths, viewed, sha),
    );
  }
}
