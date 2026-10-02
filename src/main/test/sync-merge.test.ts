import { describe, expect, it } from 'vitest';
import {
  collectPendingGeneralReplies,
  composeBody,
  countPendingChanges,
  groupPendingByCommit,
  mergeThreads,
  mergeViewed,
} from '../helpers/github/reviewMapping';
import {
  type Comment,
  type LocalViewedState,
  type RemoteViewedFile,
  type ReviewThread,
  generalCommentAnchor,
} from '@gepard/common';

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    threadId: 'PRRT_1',
    reviewId: null,
    reviewState: null,
    author: { login: 'alice' },
    body: 'body',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastEditedAt: null,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: false,
    viewerCanDelete: false,
    ...overrides,
  };
}

function makeThread(
  overrides: Partial<ReviewThread> & { id: string; comments: Comment[] },
): ReviewThread {
  return {
    prId: 'PR_1',
    anchor: {
      path: 'a.ts',
      subjectType: 'LINE',
      side: 'RIGHT',
      line: 1,
      startLine: null,
      startSide: null,
      originalLine: 1,
      originalStartLine: null,
      commitOid: '1111111111111111111111111111111111111111',
      originalCommitOid: '1111111111111111111111111111111111111111',
    },
    isResolved: false,
    isOutdated: false,
    ...overrides,
  };
}

describe('composeBody', () => {
  it('returns the raw body unchanged when there are no references', () => {
    const comment = makeComment({ id: 'c1', body: 'plain comment' });
    expect(composeBody(comment)).toBe('plain comment');
  });

  it('appends one "path:line" reference per line, newline-separated', () => {
    const comment = makeComment({
      id: 'c1',
      body: 'see this',
      local: {
        status: 'new',
        updatedAt: '2024-01-01T00:00:00Z',
        references: [
          { path: 'src/a.ts', line: 5, kind: 'exact' },
          { path: 'src/b.ts', line: 9, kind: 'symbol' },
        ],
      },
    });
    expect(composeBody(comment)).toBe('see this\n\nsrc/a.ts:5\nsrc/b.ts:9');
  });

  it('dedupes identical references', () => {
    const comment = makeComment({
      id: 'c1',
      body: 'dup refs',
      local: {
        status: 'new',
        updatedAt: '2024-01-01T00:00:00Z',
        references: [
          { path: 'src/a.ts', line: 5, kind: 'exact' },
          { path: 'src/a.ts', line: 5, kind: 'pattern' },
        ],
      },
    });
    expect(composeBody(comment)).toBe('dup refs\n\nsrc/a.ts:5');
  });
});

describe('mergeThreads', () => {
  it('keeps local drafts (a new thread and a new reply) the remote has not seen yet', () => {
    const draftThread = makeThread({
      id: 'local:new-thread',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:new-comment',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    const syncedThread = makeThread({
      id: 'PRRT_1',
      comments: [
        makeComment({ id: 'PRRC_1' }),
        makeComment({
          id: 'local:new-reply',
          replyToId: 'PRRC_1',
          local: { status: 'new', updatedAt: '2024-01-01T00:01:00Z', references: [] },
        }),
      ],
    });
    const remoteThread = makeThread({ id: 'PRRT_1', comments: [makeComment({ id: 'PRRC_1' })] });

    const result = mergeThreads([draftThread, syncedThread], [remoteThread]);

    expect(result.find((t) => t.id === 'local:new-thread')).toBe(draftThread);
    const merged = result.find((t) => t.id === 'PRRT_1');
    expect(merged?.comments.map((c) => c.id).sort()).toEqual(['PRRC_1', 'local:new-reply']);
  });

  it('lets a newer remote edit win, inserts new remote comments, and drops ones missing from remote', () => {
    const local = makeThread({
      id: 'PRRT_2',
      comments: [
        makeComment({
          id: 'C1',
          body: 'old body',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
        makeComment({
          id: 'C2',
          body: 'still here?',
          createdAt: '2024-01-01T00:01:00Z',
          updatedAt: '2024-01-01T00:01:00Z',
        }),
      ],
    });
    const remote = makeThread({
      id: 'PRRT_2',
      comments: [
        makeComment({
          id: 'C1',
          body: 'new body',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        }),
        makeComment({
          id: 'C3',
          body: 'brand new',
          createdAt: '2024-01-01T00:02:00Z',
          updatedAt: '2024-01-01T00:02:00Z',
        }),
      ],
    });

    const [merged] = mergeThreads([local], [remote]);
    const byId = new Map(merged.comments.map((c) => [c.id, c]));
    expect(byId.get('C1')?.body).toBe('new body');
    expect(byId.has('C2')).toBe(false);
    expect(byId.get('C3')?.body).toBe('brand new');
  });

  it('keeps an unchanged local copy when the remote copy is not newer', () => {
    const local = makeThread({
      id: 'PRRT_3',
      comments: [makeComment({ id: 'C1', body: 'local wins', updatedAt: '2024-01-02T00:00:00Z' })],
    });
    const remote = makeThread({
      id: 'PRRT_3',
      comments: [
        makeComment({ id: 'C1', body: 'stale remote', updatedAt: '2024-01-01T00:00:00Z' }),
      ],
    });
    const [merged] = mergeThreads([local], [remote]);
    expect(merged.comments[0].body).toBe('local wins');
  });

  it('drops a synced thread missing from the remote, but keeps one pending local deletion', () => {
    const deletedRemotely = makeThread({ id: 'PRRT_gone', comments: [makeComment({ id: 'C1' })] });
    const pendingDelete = makeThread({
      id: 'PRRT_pending',
      local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [makeComment({ id: 'C2' })],
    });
    const remoteStillHasPendingDelete = makeThread({
      id: 'PRRT_pending',
      comments: [makeComment({ id: 'C2' })],
    });

    const result = mergeThreads([deletedRemotely, pendingDelete], [remoteStillHasPendingDelete]);

    expect(result.find((t) => t.id === 'PRRT_gone')).toBeUndefined();
    const kept = result.find((t) => t.id === 'PRRT_pending');
    expect(kept?.local).toEqual({ status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' });
  });
});

describe('mergeThreads with a general (anchor-less) PR comment', () => {
  it('keeps a not-yet-pushed general comment, anchor-agnostic like any other thread', () => {
    const draft = makeThread({
      id: 'local:general-1',
      anchor: generalCommentAnchor(),
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:general-comment',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    const result = mergeThreads([draft], []);
    expect(result).toEqual([draft]);
  });

  it('counts a pending general comment the same way as a pending review thread', () => {
    const draft = makeThread({
      id: 'local:general-1',
      anchor: generalCommentAnchor(),
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:general-comment',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    expect(
      countPendingChanges({
        threads: [draft],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });
});

describe('collectPendingGeneralReplies', () => {
  it('collects a still-new non-root comment on a general thread, but not its (already-synced) root', () => {
    const thread = makeThread({
      id: 'IC_root',
      anchor: generalCommentAnchor(),
      comments: [
        makeComment({ id: 'IC_root' }),
        makeComment({
          id: 'local:reply-1',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });

    const pending = collectPendingGeneralReplies([thread]);

    expect(pending).toHaveLength(1);
    expect(pending[0].comment.id).toBe('local:reply-1');
    expect(pending[0].thread).toBe(thread);
  });

  it('also collects new replies on a not-yet-pushed general thread', () => {
    const thread = makeThread({
      id: 'local:general-1',
      anchor: generalCommentAnchor(),
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
        makeComment({
          id: 'local:reply-1',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });

    expect(collectPendingGeneralReplies([thread]).map((p) => p.comment.id)).toEqual([
      'local:reply-1',
    ]);
  });

  it('ignores replies on non-general (file-anchored) threads', () => {
    const thread = makeThread({
      id: 'PRRT_1',
      comments: [
        makeComment({ id: 'root' }),
        makeComment({
          id: 'local:reply-1',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });

    expect(collectPendingGeneralReplies([thread])).toEqual([]);
  });

  it('ignores edited or deleted (not new) comments on a general thread', () => {
    const thread = makeThread({
      id: 'IC_root',
      anchor: generalCommentAnchor(),
      comments: [
        makeComment({ id: 'IC_root' }),
        makeComment({
          id: 'IC_edited-reply',
          local: { status: 'edited', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
        makeComment({
          id: 'IC_deleted-reply',
          local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });

    expect(collectPendingGeneralReplies([thread])).toEqual([]);
  });
});

describe('mergeViewed', () => {
  function remoteFile(
    path: string,
    state: RemoteViewedFile['viewerViewedState'],
  ): RemoteViewedFile {
    return { path, additions: 1, deletions: 0, changeType: 'MODIFIED', viewerViewedState: state };
  }

  it('inserts an unseen remote row, turning DISMISSED into viewed: false', () => {
    const result = mergeViewed([], [remoteFile('a.ts', 'DISMISSED')], 'PR_1', null);
    expect(result).toHaveLength(1);
    const [row] = result;
    expect(typeof row.remoteFetchedAt).toBe('string');
    expect(row).toEqual({
      prId: 'PR_1',
      path: 'a.ts',
      viewed: false,
      remote: 'DISMISSED',
      localUpdatedAt: null,
      remoteFetchedAt: row.remoteFetchedAt,
    });
  });

  it('lets the remote decide when the local row was never touched', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'b.ts',
        viewed: false,
        remote: null,
        localUpdatedAt: null,
        remoteFetchedAt: null,
      },
    ];
    const [row] = mergeViewed(local, [remoteFile('b.ts', 'VIEWED')], 'PR_1', null);
    expect(row.viewed).toBe(true);
    expect(row.remote).toBe('VIEWED');
  });

  it('keeps an unpushed local change across a pull (never synced yet)', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'c.ts',
        viewed: true,
        remote: null,
        localUpdatedAt: '2024-01-01T00:00:00Z',
        remoteFetchedAt: null,
      },
    ];
    const [row] = mergeViewed(local, [remoteFile('c.ts', 'UNVIEWED')], 'PR_1', null);
    expect(row.viewed).toBe(true);
    expect(row.remote).toBe('UNVIEWED');
    expect(row.localUpdatedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('lets the remote win once the local change is older than the last successful sync', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'd.ts',
        viewed: true,
        remote: 'VIEWED',
        localUpdatedAt: '2024-01-01T00:00:00Z',
        remoteFetchedAt: '2024-01-01T00:00:00Z',
      },
    ];
    const [row] = mergeViewed(
      local,
      [remoteFile('d.ts', 'DISMISSED')],
      'PR_1',
      '2024-01-02T00:00:00Z',
    );
    expect(row.viewed).toBe(false);
    expect(row.remote).toBe('DISMISSED');
  });
});

describe('groupPendingByCommit', () => {
  const HEAD = '2222222222222222222222222222222222222222';
  const OTHER = '3333333333333333333333333333333333333333';

  it('includes a reply added to a still-unsynced new thread, not just its root', () => {
    const thread = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
        makeComment({
          id: 'local:reply',
          replyToId: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:01:00Z', references: [] },
        }),
      ],
    });
    const [group] = groupPendingByCommit([thread], HEAD);
    expect(group.newThreads).toEqual([thread]);
    expect(group.replies).toHaveLength(1);
    expect(group.replies[0].comment.id).toBe('local:reply');
  });

  it('rejects a new LEFT-side thread anchored to a commit other than the head', () => {
    const thread = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'LEFT',
        line: 3,
        startLine: null,
        startSide: null,
        originalLine: 3,
        originalStartLine: null,
        commitOid: OTHER,
        originalCommitOid: OTHER,
      },
      comments: [
        makeComment({
          id: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    expect(() => groupPendingByCommit([thread], HEAD)).toThrow(/LEFT/);
  });

  it('accepts a new LEFT-side thread anchored to the head commit', () => {
    const thread = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'LEFT',
        line: 3,
        startLine: null,
        startSide: null,
        originalLine: 3,
        originalStartLine: null,
        commitOid: HEAD,
        originalCommitOid: HEAD,
      },
      comments: [
        makeComment({
          id: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    const groups = groupPendingByCommit([thread], HEAD);
    expect(groups).toHaveLength(1);
    expect(groups[0].commitOid).toBe(HEAD);
  });

  it('groups a RIGHT-side new thread under the commit it was drafted against', () => {
    const thread = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:root',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    const groups = groupPendingByCommit([thread], HEAD);
    expect(groups).toHaveLength(1);
    expect(groups[0].commitOid).toBe('1111111111111111111111111111111111111111');
  });
});

describe('countPendingChanges', () => {
  function viewedRow(overrides: Partial<LocalViewedState> & { path: string }): LocalViewedState {
    return {
      prId: 'PR_1',
      viewed: true,
      remote: null,
      localUpdatedAt: null,
      remoteFetchedAt: null,
      ...overrides,
    };
  }

  it('is zero for a store with nothing pending', () => {
    const synced = makeThread({ id: 'PRRT_1', comments: [makeComment({ id: 'C1' })] });
    expect(
      countPendingChanges({
        threads: [synced],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(0);
  });

  it('counts a new (not yet synced) thread as one', () => {
    const draft = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:c1',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    expect(
      countPendingChanges({
        threads: [draft],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });

  it('counts a new reply once, and never double-counts its thread root', () => {
    const thread = makeThread({
      id: 'PRRT_1',
      comments: [
        makeComment({ id: 'C1' }),
        makeComment({
          id: 'local:reply',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    expect(
      countPendingChanges({
        threads: [thread],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });

  it('counts a whole-thread deletion once, regardless of its reply count', () => {
    const thread = makeThread({
      id: 'PRRT_1',
      local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [makeComment({ id: 'C1' }), makeComment({ id: 'C2' }), makeComment({ id: 'C3' })],
    });
    expect(
      countPendingChanges({
        threads: [thread],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });

  it('counts a single deleted reply in an otherwise-synced thread', () => {
    const thread = makeThread({
      id: 'PRRT_1',
      comments: [
        makeComment({ id: 'C1' }),
        makeComment({
          id: 'C2',
          local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    expect(
      countPendingChanges({
        threads: [thread],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });

  it('counts a viewed row touched since the last successful sync, and ignores one that is not', () => {
    const dirty = viewedRow({
      path: 'a.ts',
      localUpdatedAt: '2024-01-02T00:00:00Z',
      remoteFetchedAt: '2024-01-01T00:00:00Z',
    });
    const clean = viewedRow({
      path: 'b.ts',
      localUpdatedAt: '2024-01-01T00:00:00Z',
      remoteFetchedAt: '2024-01-02T00:00:00Z',
    });
    const untouched = viewedRow({ path: 'c.ts', localUpdatedAt: null, remoteFetchedAt: null });
    expect(
      countPendingChanges({
        threads: [],
        viewed: [dirty, clean, untouched],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(1);
  });

  it('sums pending threads, comments and viewed rows together', () => {
    const newThread = makeThread({
      id: 'local:t1',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:c1',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] },
        }),
      ],
    });
    const deletedThread = makeThread({
      id: 'PRRT_2',
      local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [makeComment({ id: 'C1' })],
    });
    const dirtyViewed = viewedRow({
      path: 'a.ts',
      localUpdatedAt: '2024-01-02T00:00:00Z',
      remoteFetchedAt: null,
    });
    expect(
      countPendingChanges({
        threads: [newThread, deletedThread],
        viewed: [dirtyViewed],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      }),
    ).toBe(3);
  });
});
