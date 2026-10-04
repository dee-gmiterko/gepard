import { AppError } from '@gepard/common';
import type { SyncMode } from '@gepard/common';
import { log } from '../log';
import { GhService, ghService as defaultGhService } from './gh';
import { GitService, gitService as defaultGitService } from './git';
import * as review from '../store/review';
import { withReviewLock, type ReviewStoreFile } from '../store/review';
import {
  collectPendingGeneralReplies,
  composeBody,
  groupPendingByCommit,
  isRemoteNotFoundError,
  isViewedDirty,
  mapGeneralComment,
  mapThread,
  mergeThreads,
  mergeViewed,
  type PendingGroup,
} from '../helpers/github/reviewMapping';

interface PushOutcome {
  pushedCount: number;
  goneRemotely: number;
}

export interface SyncResult {
  syncedAt: string;
  droppedRemoteDeleted: number;
  base: string;
  head: string;
}

export interface SyncContext {
  owner: string;
  repo: string;
}

export class SyncService {
  constructor(
    private readonly gh: GhService = defaultGhService,
    private readonly git: GitService = defaultGitService,
  ) {}

  private async pushViewed(
    store: ReviewStoreFile,
    prId: string,
    prPaths: ReadonlySet<string>,
  ): Promise<number> {
    const now = new Date().toISOString();
    const dirty = store.viewed.filter(isViewedDirty);
    if (dirty.length === 0) return 0;
    const stalePaths = new Set(dirty.filter((v) => !prPaths.has(v.path)).map((v) => v.path));
    if (stalePaths.size > 0) {
      store.viewed = store.viewed.filter((v) => !stalePaths.has(v.path));
    }
    const pushable = dirty.filter((v) => !stalePaths.has(v.path));
    if (pushable.length === 0) return 0;
    await this.gh.setFilesViewed(
      prId,
      pushable.map((v) => ({ path: v.path, viewed: v.viewed })),
    );
    for (const v of pushable) {
      v.remote = v.viewed ? 'VIEWED' : 'UNVIEWED';
      v.remoteFetchedAt = now;
    }
    return pushable.length;
  }

  // GitHub deletes and edits review comments without a pending review.
  private async pushDeletions(
    projectId: string,
    pr: number,
    store: ReviewStoreFile,
  ): Promise<PushOutcome> {
    let pushedCount = 0;
    let goneRemotely = 0;
    for (const thread of [...store.threads]) {
      const isGeneral = thread.anchor.subjectType === 'PR';
      if (thread.local?.status === 'deleted') {
        const root = thread.comments[0];
        if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`);
        try {
          if (isGeneral) await this.gh.deleteGeneralComment(root.id);
          else await this.gh.deleteReviewComment(root.id);
          pushedCount++;
        } catch (e) {
          if (!isRemoteNotFoundError(e)) throw e;
          goneRemotely++;
        }
        store.threads = store.threads.filter((t) => t.id !== thread.id);
        await review.saveReview(projectId, pr, store);
        continue;
      }
      for (const comment of [...thread.comments]) {
        if (comment.local?.status !== 'deleted') continue;
        try {
          if (isGeneral) await this.gh.deleteGeneralComment(comment.id);
          else await this.gh.deleteReviewComment(comment.id);
          pushedCount++;
        } catch (e) {
          if (!isRemoteNotFoundError(e)) throw e;
          goneRemotely++;
        }
        thread.comments = thread.comments.filter((c) => c.id !== comment.id);
        await review.saveReview(projectId, pr, store);
      }
    }
    return { pushedCount, goneRemotely };
  }

  private async pushEdits(
    projectId: string,
    pr: number,
    store: ReviewStoreFile,
  ): Promise<PushOutcome> {
    let pushedCount = 0;
    let goneRemotely = 0;
    for (const thread of [...store.threads]) {
      const isGeneral = thread.anchor.subjectType === 'PR';
      for (const comment of [...thread.comments]) {
        if (comment.local?.status !== 'edited') continue;
        const body = composeBody(comment);
        try {
          const result = isGeneral
            ? await this.gh.updateGeneralComment(comment.id, body)
            : await this.gh.updateReviewComment(comment.id, body);
          comment.body = body;
          comment.updatedAt = result.updatedAt;
          comment.lastEditedAt = result.lastEditedAt;
          comment.local = undefined;
          pushedCount++;
        } catch (e) {
          if (!isRemoteNotFoundError(e)) throw e;
          goneRemotely++;
          if (thread.comments[0]?.id === comment.id) {
            store.threads = store.threads.filter((t) => t.id !== thread.id);
          } else {
            thread.comments = thread.comments.filter((c) => c.id !== comment.id);
          }
        }
        await review.saveReview(projectId, pr, store);
      }
    }
    return { pushedCount, goneRemotely };
  }

  // General PR comments post immediately, with no pending review to batch
  // them into, unlike a new review thread.
  private async pushGeneralComments(
    projectId: string,
    pr: number,
    store: ReviewStoreFile,
    prId: string,
  ): Promise<number> {
    let pushedCount = 0;
    for (const thread of store.threads) {
      if (thread.anchor.subjectType !== 'PR' || thread.local?.status !== 'new') continue;
      const root = thread.comments[0];
      if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`);
      const body = composeBody(root);
      const result = await this.gh.addGeneralComment(prId, body);
      const oldThreadId = thread.id;
      thread.id = result.id;
      thread.local = undefined;
      root.id = result.id;
      root.threadId = thread.id;
      root.createdAt = result.createdAt;
      root.updatedAt = result.updatedAt;
      root.body = body;
      root.local = undefined;
      for (const c of thread.comments) {
        if (c.threadId === oldThreadId) c.threadId = thread.id;
      }
      pushedCount++;
      await review.saveReview(projectId, pr, store);
    }

    for (const { thread, comment } of collectPendingGeneralReplies(store.threads)) {
      const body = composeBody(comment);
      const result = await this.gh.addGeneralComment(prId, body);
      comment.id = result.id;
      comment.createdAt = result.createdAt;
      comment.updatedAt = result.updatedAt;
      comment.body = body;
      comment.local = undefined;
      thread.comments = thread.comments.filter((c) => c !== comment);
      pushedCount++;
      await review.saveReview(projectId, pr, store);
    }

    return pushedCount;
  }

  private async ensureOwnPendingReview(
    projectId: string,
    pr: number,
    store: ReviewStoreFile,
    owner: string,
    repo: string,
    prNumber: number,
    prId: string,
    commitOid: string,
  ): Promise<string> {
    const existing = await this.gh.findPendingReview(owner, repo, prNumber);
    if (existing) {
      if (store.pendingReviewId !== existing.id) {
        store.pendingReviewId = existing.id;
        await review.saveReview(projectId, pr, store);
      }
      return existing.id;
    }
    const reviewId = await this.gh.createPendingReview(prId, commitOid);
    store.pendingReviewId = reviewId;
    await review.saveReview(projectId, pr, store);
    return reviewId;
  }

  private async pushGroup(
    projectId: string,
    pr: number,
    owner: string,
    repo: string,
    prNumber: number,
    store: ReviewStoreFile,
    prId: string,
    group: PendingGroup,
  ): Promise<number> {
    let pushedCount = 0;
    const reviewId = await this.ensureOwnPendingReview(
      projectId,
      pr,
      store,
      owner,
      repo,
      prNumber,
      prId,
      group.commitOid,
    );

    for (const thread of group.newThreads) {
      const root = thread.comments[0];
      if (!root) throw new AppError('STORE_CORRUPT', `thread ${thread.id} has no root comment`);
      const body = composeBody(root);
      const result = await this.gh.addReviewThread({
        pullRequestReviewId: reviewId,
        path: thread.anchor.path,
        body,
        line: thread.anchor.line,
        side: thread.anchor.side,
        startLine: thread.anchor.startLine,
        startSide: thread.anchor.startSide,
      });
      const oldThreadId = thread.id;
      const oldRootId = root.id;
      thread.id = result.thread.id;
      if (result.isFile) thread.anchor.subjectType = 'FILE';
      thread.anchor.line = result.thread.line;
      thread.anchor.startLine = result.thread.startLine;
      thread.isResolved = result.thread.isResolved;
      thread.local = undefined;
      root.id = result.rootComment.id;
      root.threadId = thread.id;
      root.reviewId = result.rootComment.pullRequestReview?.id ?? reviewId;
      root.reviewState = result.rootComment.pullRequestReview?.state ?? 'PENDING';
      root.createdAt = result.rootComment.createdAt;
      root.updatedAt = result.rootComment.updatedAt;
      root.body = body;
      root.local = undefined;
      for (const c of thread.comments) {
        if (c.threadId === oldThreadId) c.threadId = thread.id;
        if (c.replyToId === oldRootId) c.replyToId = root.id;
      }
      pushedCount++;
    }

    for (const { thread, comment } of group.replies) {
      const root = thread.comments[0];
      const body = composeBody(comment);
      const result = await this.gh.addReviewThreadReply(thread.id, body, reviewId);
      comment.id = result.id;
      comment.threadId = thread.id;
      comment.reviewId = result.pullRequestReview?.id ?? reviewId;
      comment.reviewState = result.pullRequestReview?.state ?? 'PENDING';
      comment.createdAt = result.createdAt;
      comment.updatedAt = result.updatedAt;
      comment.body = body;
      comment.replyToId = result.replyTo?.id ?? root?.id ?? null;
      comment.local = undefined;
      pushedCount++;
    }

    await this.gh.submitReview(reviewId);
    store.pendingReviewId = null;
    return pushedCount;
  }

  private async pushComments(
    projectId: string,
    pr: number,
    owner: string,
    repo: string,
    prNumber: number,
    store: ReviewStoreFile,
    prId: string,
    headRefOid: string,
  ): Promise<PushOutcome> {
    let pushedCount = 0;
    let goneRemotely = 0;
    const deletions = await this.pushDeletions(projectId, pr, store);
    pushedCount += deletions.pushedCount;
    goneRemotely += deletions.goneRemotely;
    const edits = await this.pushEdits(projectId, pr, store);
    pushedCount += edits.pushedCount;
    goneRemotely += edits.goneRemotely;

    pushedCount += await this.pushGeneralComments(projectId, pr, store, prId);

    const reviewThreads = store.threads.filter((t) => t.anchor.subjectType !== 'PR');
    const groups = groupPendingByCommit(reviewThreads, headRefOid);
    for (const group of groups) {
      pushedCount += await this.pushGroup(projectId, pr, owner, repo, prNumber, store, prId, group);
    }
    return { pushedCount, goneRemotely };
  }

  private async runSyncLocked(
    projectId: string,
    pr: number,
    mode: SyncMode,
    ctx: SyncContext,
  ): Promise<SyncResult> {
    log.info('sync', `projectId=${projectId} pr=${pr} mode=${mode} start`);
    const store = await review.loadReview(projectId, pr);

    const { id: prId, headRefOid, baseRefOid } = await this.gh.viewPr(ctx.owner, ctx.repo, pr);

    await this.git.fetchOrigin(projectId).catch((e: unknown) => {
      log.warn('sync', `projectId=${projectId} pr=${pr} fetch origin failed: ${String(e)}`);
    });
    const { head: currentHead } = await this.git.workingTree(projectId);
    let checkout = { base: baseRefOid, head: currentHead };
    if (currentHead !== headRefOid) {
      checkout = await this.git.checkoutTarget(projectId, {
        kind: 'pr',
        pr,
        headRefOid,
        baseRefOid,
      });
    }

    const [threadsResult, generalResult, viewedResult] = await Promise.all([
      this.gh.fetchReviewThreads(ctx.owner, ctx.repo, pr),
      this.gh.fetchGeneralComments(ctx.owner, ctx.repo, pr),
      this.gh.fetchViewedFiles(ctx.owner, ctx.repo, pr),
    ]);

    let pushedViewed = 0;
    let pushedComments = 0;
    let goneRemotely = 0;
    if (mode === 'full') {
      try {
        const prPaths = new Set(viewedResult.files.map((f) => f.path));
        pushedViewed = await this.pushViewed(store, prId, prPaths);
        const commentsOutcome = await this.pushComments(
          projectId,
          pr,
          ctx.owner,
          ctx.repo,
          pr,
          store,
          prId,
          headRefOid,
        );
        pushedComments = commentsOutcome.pushedCount;
        goneRemotely = commentsOutcome.goneRemotely;
      } finally {
        await review.saveReview(projectId, pr, store);
      }
      if (goneRemotely > 0) {
        log.warn(
          'sync',
          `projectId=${projectId} pr=${pr} dropped ${goneRemotely} local pending change(s) ` +
            `already deleted on GitHub`,
        );
      }
    }
    const remoteThreads = [
      ...threadsResult.threads.map((t) => mapThread(t, threadsResult.prId)),
      ...generalResult.comments.map((c) => mapGeneralComment(c, generalResult.prId)),
    ];
    const mergedThreads = mergeThreads(store.threads, remoteThreads);
    const mergedViewed = mergeViewed(
      store.viewed,
      viewedResult.files,
      threadsResult.prId,
      store.lastSuccessfulSyncAt,
    );

    const syncedAt = new Date().toISOString();
    const finalStore: ReviewStoreFile = {
      threads: mergedThreads,
      viewed: mergedViewed,
      pendingReviewId: store.pendingReviewId,
      lastSuccessfulSyncAt: mode === 'full' ? syncedAt : store.lastSuccessfulSyncAt,
    };
    await review.saveReview(projectId, pr, finalStore);
    log.info(
      'sync',
      `projectId=${projectId} pr=${pr} mode=${mode} end ` +
        `pushed=${pushedViewed + pushedComments} pulledThreads=${remoteThreads.length} ` +
        `pulledViewed=${viewedResult.files.length}`,
    );
    return {
      syncedAt,
      droppedRemoteDeleted: goneRemotely,
      base: checkout.base,
      head: checkout.head,
    };
  }

  async runSync(
    projectId: string,
    pr: number,
    mode: SyncMode,
    ctx: SyncContext,
  ): Promise<SyncResult> {
    return withReviewLock(projectId, pr, () => this.runSyncLocked(projectId, pr, mode, ctx));
  }
}

export const syncService = new SyncService();
