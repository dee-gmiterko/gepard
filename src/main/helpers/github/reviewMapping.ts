import type { ReviewStoreFile } from '../../store/review';
import {
  type Comment,
  type GqlIssueCommentRaw,
  type GqlReviewCommentRaw,
  type GqlReviewThreadRaw,
  type LocalViewedState,
  type RemoteViewedFile,
  type ReviewThread,
  generalCommentAnchor,
  AppError,
  ExecError,
} from '@gepard/common';

export function mapComment(raw: GqlReviewCommentRaw, threadId: string): Comment {
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
    viewerCanDelete: raw.viewerCanDelete,
  };
}

export function mapThread(raw: GqlReviewThreadRaw, prId: string): ReviewThread {
  const comments = raw.comments.nodes
    .map((c) => mapComment(c, raw.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
      originalCommitOid: raw.comments.nodes[0]?.originalCommit?.oid ?? null,
    },
    isResolved: raw.isResolved,
    isOutdated: raw.isOutdated,
    comments,
  };
}

export function mapGeneralComment(raw: GqlIssueCommentRaw, prId: string): ReviewThread {
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
    viewerCanDelete: raw.viewerCanDelete,
  };
  return {
    id: raw.id,
    prId,
    anchor: generalCommentAnchor(),
    isResolved: false,
    isOutdated: false,
    comments: [comment],
  };
}

function mergeOneThread(localThread: ReviewThread, remoteThread: ReviewThread): ReviewThread {
  const localById = new Map(localThread.comments.map((c) => [c.id, c]));
  const merged: Comment[] = [];
  for (const c of localThread.comments)
    if (c.local?.status === 'new' || c.local?.status === 'edited') merged.push(c);
  for (const remoteComment of remoteThread.comments) {
    const localComment = localById.get(remoteComment.id);
    if (!localComment) {
      merged.push(remoteComment);
      continue;
    }
    if (localComment.local?.status === 'new' || localComment.local?.status === 'edited') continue;
    if (localComment.local?.status === 'deleted') {
      merged.push(localComment);
      continue;
    }
    merged.push(remoteComment.updatedAt > localComment.updatedAt ? remoteComment : localComment);
  }
  merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    ...remoteThread,
    comments: merged,
    local: localThread.local?.status === 'deleted' ? localThread.local : undefined,
  };
}

export function mergeThreads(local: ReviewThread[], remote: ReviewThread[]): ReviewThread[] {
  const localById = new Map(local.map((t) => [t.id, t]));
  const remoteById = new Map(remote.map((t) => [t.id, t]));
  const result: ReviewThread[] = [];

  for (const t of local) if (t.local?.status === 'new') result.push(t);

  for (const [id, remoteThread] of remoteById) {
    const localThread = localById.get(id);
    result.push(localThread ? mergeOneThread(localThread, remoteThread) : remoteThread);
  }
  return result;
}

export function mergeViewed(
  local: LocalViewedState[],
  remote: RemoteViewedFile[],
  prId: string,
  lastSuccessfulSyncAt: string | null,
): LocalViewedState[] {
  const byPath = new Map(local.map((v) => [v.path, v]));
  const now = new Date().toISOString();
  for (const file of remote) {
    // GitHub's viewerViewedState also has a DISMISSED state.
    const remoteViewed = file.viewerViewedState === 'VIEWED';
    const existing = byPath.get(file.path);
    if (!existing) {
      byPath.set(file.path, {
        prId,
        path: file.path,
        viewed: remoteViewed,
        remote: file.viewerViewedState,
        localUpdatedAt: null,
        remoteFetchedAt: now,
      });
      continue;
    }
    const localWins =
      existing.localUpdatedAt !== null &&
      (lastSuccessfulSyncAt === null || existing.localUpdatedAt > lastSuccessfulSyncAt);
    existing.remote = file.viewerViewedState;
    if (!localWins) {
      existing.viewed = remoteViewed;
      existing.remoteFetchedAt = now;
    }
  }
  return Array.from(byPath.values());
}

export function isViewedDirty(v: LocalViewedState): boolean {
  return (
    v.localUpdatedAt !== null &&
    (v.remoteFetchedAt === null || v.localUpdatedAt > v.remoteFetchedAt)
  );
}

export function composeBody(comment: Comment): string {
  const refs = comment.local?.references ?? [];
  if (refs.length === 0) return comment.body;
  const lines = [...new Set(refs.map((r) => `${r.path}:${r.line}`))];
  return `${comment.body}\n\n${lines.join('\n')}`;
}

// GitHub's IssueComment (a general PR comment) has no reply target: unlike a
// review thread, there is nothing on GitHub's side to nest a reply under.
// A locally-drafted "reply" to a general comment is only a local grouping
// convenience, so once pushed it becomes its own independent, top-level PR
// comment - exactly like a fresh general comment.
export function collectPendingGeneralReplies(
  threads: ReviewThread[],
): { thread: ReviewThread; comment: Comment }[] {
  const pending: { thread: ReviewThread; comment: Comment }[] = [];
  for (const thread of threads) {
    if (thread.anchor.subjectType !== 'PR') continue;
    const root = thread.comments[0];
    for (const comment of thread.comments) {
      if (comment === root || comment.local?.status !== 'new') continue;
      pending.push({ thread, comment });
    }
  }
  return pending;
}

export interface PendingGroup {
  commitOid: string;
  newThreads: ReviewThread[];
  replies: { thread: ReviewThread; comment: Comment }[];
}

// GitHub reads a LEFT-side line against the PR base, never against the
// immediate parent of the commit a review happens to be pinned to.
function assertLeftAnchorAgainstBase(thread: ReviewThread, headRefOid: string): void {
  if (thread.anchor.side !== 'LEFT') return;
  const commitOid = thread.anchor.commitOid ?? headRefOid;
  if (commitOid !== headRefOid) {
    throw new AppError(
      'UNSUPPORTED_LEFT_ANCHOR',
      `cannot push the LEFT-side comment on ${thread.anchor.path} anchored to commit ${commitOid}: ` +
        "GitHub reads LEFT-side lines against the PR base, not a single commit's parent",
    );
  }
}

export function groupPendingByCommit(threads: ReviewThread[], headRefOid: string): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  const groupFor = (commitOid: string | null): PendingGroup => {
    const key = commitOid ?? headRefOid;
    let g = groups.get(key);
    if (!g) {
      g = { commitOid: key, newThreads: [], replies: [] };
      groups.set(key, g);
    }
    return g;
  };
  for (const thread of threads) {
    if (thread.local?.status === 'new') {
      assertLeftAnchorAgainstBase(thread, headRefOid);
      groupFor(thread.anchor.commitOid).newThreads.push(thread);
    }
    const root = thread.comments[0];
    for (const comment of thread.comments) {
      if (comment === root || comment.local?.status !== 'new') continue;
      groupFor(thread.anchor.commitOid).replies.push({ thread, comment });
    }
  }
  return Array.from(groups.values());
}

export function countPendingChanges(store: ReviewStoreFile): number {
  let count = 0;
  for (const thread of store.threads) {
    if (thread.local?.status === 'new') count += 1;
    if (thread.local?.status === 'deleted') {
      count += 1;
      continue;
    }
    const root = thread.comments[0];
    for (const comment of thread.comments) {
      if (comment === root) continue;
      if (comment.local?.status === 'new' || comment.local?.status === 'deleted') count += 1;
    }
  }
  for (const thread of store.threads) {
    for (const comment of thread.comments) {
      if (comment.local?.status === 'edited') count += 1;
    }
  }
  return count + store.viewed.filter(isViewedDirty).length;
}

// GitHub errors a mutation on a comment someone else already deleted with a
// GraphQL NOT_FOUND partial error rather than a benign no-op. `gh api
// graphql` exits non-zero on that response and prints "gh: <message>
// (<type>)" to stderr, so the failure surfaces as an ExecError before any
// JSON body is parsed.
export function isRemoteNotFoundError(e: unknown): boolean {
  return e instanceof ExecError && /\(NOT_FOUND\)/.test(e.stderr);
}
