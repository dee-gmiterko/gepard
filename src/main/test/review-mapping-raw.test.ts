import { describe, expect, it } from 'vitest';
import {
  isRemoteNotFoundError,
  isViewedDirty,
  mapComment,
  mapGeneralComment,
  mapThread,
} from '../helpers/github/reviewMapping';
import { checkGqlErrors, isLineNotInDiffError } from '../helpers/github/ghParsing';
import { ExecError } from '../helpers/process/exec';
import type {
  GqlIssueCommentRaw,
  GqlReviewCommentRaw,
  GqlReviewThreadRaw,
  LocalViewedState,
} from '@gepard/common';

const sha = 'a'.repeat(40);

function rawComment(overrides: Partial<GqlReviewCommentRaw> = {}): GqlReviewCommentRaw {
  return {
    id: 'C1',
    author: { login: 'alice' },
    body: 'hello',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    lastEditedAt: null,
    path: 'a.ts',
    line: 3,
    originalLine: 3,
    startLine: null,
    originalStartLine: null,
    outdated: false,
    state: 'SUBMITTED',
    commit: { oid: sha },
    originalCommit: { oid: sha },
    replyTo: null,
    pullRequestReview: { id: 'R1', state: 'COMMENTED' },
    viewerDidAuthor: true,
    viewerCanDelete: false,
    ...overrides,
  };
}

function execError(stderr: string): ExecError {
  return new ExecError('EXEC_FAILED', 'failed', 'gh', [], 1, stderr);
}

describe('mapComment', () => {
  it('maps fields and the review reference', () => {
    expect(mapComment(rawComment(), 'T1')).toMatchObject({
      id: 'C1',
      threadId: 'T1',
      reviewId: 'R1',
      reviewState: 'COMMENTED',
      author: { login: 'alice' },
      replyToId: null,
    });
  });

  it('falls back to ghost for a deleted author and null review', () => {
    const out = mapComment(rawComment({ author: null, pullRequestReview: null }), 'T1');
    expect(out.author?.login).toBe('ghost');
    expect(out.reviewId).toBeNull();
  });
});

describe('mapThread', () => {
  const thread: GqlReviewThreadRaw = {
    id: 'T1',
    isResolved: false,
    isOutdated: false,
    path: 'a.ts',
    line: 3,
    originalLine: 3,
    startLine: null,
    originalStartLine: null,
    diffSide: 'RIGHT',
    startDiffSide: null,
    subjectType: 'LINE',
    comments: {
      totalCount: 2,
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        rawComment({ id: 'late', createdAt: '2024-02-01T00:00:00Z' }),
        rawComment({ id: 'early', createdAt: '2024-01-01T00:00:00Z' }),
      ],
    },
  };

  it('sorts comments by creation date and derives the anchor', () => {
    const out = mapThread(thread, 'PR1');
    expect(out.comments.map((c) => c.id)).toEqual(['early', 'late']);
    expect(out.prId).toBe('PR1');
    expect(out.anchor).toMatchObject({ path: 'a.ts', side: 'RIGHT', line: 3, commitOid: sha });
  });

  it('has null commit oids for a thread without comments', () => {
    const empty = { ...thread, comments: { ...thread.comments, nodes: [] } };
    expect(mapThread(empty, 'PR1').anchor).toMatchObject({
      commitOid: null,
      originalCommitOid: null,
    });
  });
});

describe('mapGeneralComment', () => {
  const raw: GqlIssueCommentRaw = {
    id: 'IC1',
    author: null,
    body: 'general',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastEditedAt: null,
    viewerDidAuthor: false,
    viewerCanDelete: true,
  };

  it('wraps the comment in a PR-level thread of its own', () => {
    const out = mapGeneralComment(raw, 'PR1');
    expect(out).toMatchObject({ id: 'IC1', prId: 'PR1', isResolved: false });
    expect(out.anchor.subjectType).toBe('PR');
    expect(out.comments[0]).toMatchObject({ threadId: 'IC1', author: { login: 'ghost' } });
  });
});

describe('isViewedDirty', () => {
  const state = (patch: Partial<LocalViewedState>): LocalViewedState => ({
    prId: 'PR1',
    path: 'a.ts',
    viewed: true,
    remote: null,
    localUpdatedAt: null,
    remoteFetchedAt: null,
    ...patch,
  });

  it('is false without a local change', () => {
    expect(isViewedDirty(state({}))).toBe(false);
  });

  it('is true when never fetched or changed after the last fetch', () => {
    expect(isViewedDirty(state({ localUpdatedAt: '2024-01-02T00:00:00Z' }))).toBe(true);
    expect(
      isViewedDirty(
        state({ localUpdatedAt: '2024-01-02T00:00:00Z', remoteFetchedAt: '2024-01-01T00:00:00Z' }),
      ),
    ).toBe(true);
  });

  it('is false when the fetch is newer than the local change', () => {
    expect(
      isViewedDirty(
        state({ localUpdatedAt: '2024-01-01T00:00:00Z', remoteFetchedAt: '2024-01-02T00:00:00Z' }),
      ),
    ).toBe(false);
  });
});

describe('isRemoteNotFoundError', () => {
  it('matches an ExecError with a NOT_FOUND stderr', () => {
    expect(isRemoteNotFoundError(execError('gh: Could not resolve (NOT_FOUND)'))).toBe(true);
    expect(isRemoteNotFoundError(execError('gh: other'))).toBe(false);
    expect(isRemoteNotFoundError(new Error('(NOT_FOUND)'))).toBe(false);
  });
});

describe('isLineNotInDiffError', () => {
  it('matches an ExecError whose stderr says the line must be part of the diff', () => {
    expect(isLineNotInDiffError(execError('Line must be part of the diff'))).toBe(true);
    expect(isLineNotInDiffError(execError('boom'))).toBe(false);
    expect(isLineNotInDiffError('must be part of the diff')).toBe(false);
  });
});

describe('checkGqlErrors', () => {
  it('does nothing without errors', () => {
    expect(() => checkGqlErrors(undefined)).not.toThrow();
    expect(() => checkGqlErrors([])).not.toThrow();
  });

  it('throws GRAPHQL_ERROR joining the messages', () => {
    expect(() => checkGqlErrors([{ message: 'one' }, { message: 'two' }])).toThrow('one; two');
  });
});
