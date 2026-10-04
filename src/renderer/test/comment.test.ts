import { describe, expect, it } from 'vitest';
import {
  codeViewCommentEntries,
  diffViewCommentEntries,
  fileReference,
  prThreadsReferencingFile,
  sortThreadsChronologically,
} from '../src/helpers/comment';
import type { Anchor, Comment, ReviewThread } from '@gepard/common';

const HEAD = '1111111111111111111111111111111111111111';
const OTHER = '2222222222222222222222222222222222222222';

function comment(id: string): Comment {
  return {
    id,
    threadId: id,
    reviewId: null,
    reviewState: null,
    author: { login: 'octocat' },
    body: `comment ${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    lastEditedAt: null,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: false,
    viewerCanDelete: false,
  };
}

function thread(overrides: Partial<ReviewThread> & { id: string }): ReviewThread {
  return {
    prId: 'PR_1',
    anchor: {
      path: 'a.ts',
      subjectType: 'LINE',
      side: 'RIGHT',
      line: 5,
      startLine: null,
      startSide: null,
      originalLine: 5,
      originalStartLine: null,
      commitOid: HEAD,
      originalCommitOid: HEAD,
    },
    isResolved: false,
    isOutdated: false,
    comments: [comment(overrides.id)],
    ...overrides,
  };
}

describe('codeViewCommentEntries', () => {
  it('maps a matching thread onto its file line, using the line number directly', () => {
    const t = thread({ id: 't1' });
    const entries = codeViewCommentEntries([t], 'a.ts', null, HEAD);
    expect(entries).toEqual([{ docLine: 5, threads: [t], draft: null }]);
  });

  it('ignores threads for a different path, an outdated thread, or one anchored to another commit', () => {
    const otherPath = thread({
      id: 't2',
      anchor: { ...thread({ id: 't2' }).anchor, path: 'b.ts' },
    });
    const outdated = thread({ id: 't3', isOutdated: true });
    const otherCommit = thread({
      id: 't4',
      anchor: { ...thread({ id: 't4' }).anchor, commitOid: OTHER },
    });
    expect(codeViewCommentEntries([otherPath, outdated, otherCommit], 'a.ts', null, HEAD)).toEqual(
      [],
    );
  });

  it('keeps threads from any commit when no head is given, as for unassigned comments', () => {
    const otherCommit = thread({
      id: 't6',
      anchor: { ...thread({ id: 't6' }).anchor, commitOid: OTHER },
    });
    const outdated = thread({ id: 't7', isOutdated: true });
    expect(codeViewCommentEntries([otherCommit, outdated], 'a.ts', null, null)).toEqual([
      { docLine: 5, threads: [otherCommit], draft: null },
    ]);
  });

  it('ignores a LEFT-side thread, since a file view only ever shows one side', () => {
    const left = thread({ id: 't5', anchor: { ...thread({ id: 't5' }).anchor, side: 'LEFT' } });
    expect(codeViewCommentEntries([left], 'a.ts', null, HEAD)).toEqual([]);
  });

  it('adds a draft entry on its own line when no thread is there yet', () => {
    const entries = codeViewCommentEntries([], 'a.ts', 9, HEAD);
    expect(entries).toEqual([
      {
        docLine: 9,
        threads: [],
        draft: {
          path: 'a.ts',
          subjectType: 'LINE',
          side: 'RIGHT',
          line: 9,
          startLine: null,
          startSide: null,
        },
      },
    ]);
  });

  it('attaches the draft to an existing line entry instead of duplicating it', () => {
    const t = thread({ id: 't1' });
    const entries = codeViewCommentEntries([t], 'a.ts', 5, HEAD);
    expect(entries).toHaveLength(1);
    expect(entries[0].threads).toEqual([t]);
    expect(entries[0].draft).not.toBeNull();
  });
});

const anchor = (patch: Partial<Anchor>): Anchor => ({
  path: 'a.ts',
  subjectType: 'LINE',
  side: 'RIGHT',
  line: 5,
  startLine: null,
  startSide: null,
  originalLine: 4,
  originalStartLine: null,
  commitOid: 'head-sha',
  originalCommitOid: null,
  ...patch,
});

describe('diffViewCommentEntries', () => {
  const infos = [
    { oldLine: 1, newLine: 1 },
    { oldLine: 2, newLine: null },
    { oldLine: null, newLine: 2 },
  ];
  const thread = (
    id: string,
    patch: Partial<Anchor>,
    extra: Partial<ReviewThread> = {},
  ): ReviewThread => ({
    id,
    prId: 'PR_1',
    anchor: anchor(patch),
    isResolved: false,
    isOutdated: false,
    comments: [],
    ...extra,
  });

  it('places threads on the document line of their side', () => {
    const entries = diffViewCommentEntries(
      [
        thread('t1', { side: 'LEFT', line: 2 }),
        thread('t2', { side: 'RIGHT', line: 2 }),
        thread('skip', { path: 'other.ts', line: 1 }),
        thread('stale', { line: 1 }, { isOutdated: true }),
      ],
      'a.ts',
      infos,
      null,
      'head-sha',
    );
    expect(entries.map((e) => [e.docLine, e.threads.map((t) => t.id)])).toEqual([
      [2, ['t1']],
      [3, ['t2']],
    ]);
  });

  it('attaches a draft to an existing entry or creates one', () => {
    const entries = diffViewCommentEntries(
      [thread('t1', { side: 'LEFT', line: 2 })],
      'a.ts',
      infos,
      { docLine: 2, side: 'LEFT' },
      'head-sha',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].draft).toMatchObject({ side: 'LEFT', line: 2 });

    const created = diffViewCommentEntries([], 'a.ts', infos, { docLine: 3, side: 'RIGHT' }, 'h');
    expect(created[0]).toMatchObject({ docLine: 3, threads: [], draft: { line: 2 } });
  });

  it('ignores a draft on a side with no line', () => {
    expect(diffViewCommentEntries([], 'a.ts', infos, { docLine: 2, side: 'RIGHT' }, 'h')).toEqual(
      [],
    );
  });
});

function timedComment(id: string, createdAt: string): Comment {
  return {
    id,
    threadId: 'thread',
    reviewId: null,
    reviewState: null,
    author: { login: 'octocat' },
    body: `comment ${id}`,
    createdAt,
    updatedAt: createdAt,
    lastEditedAt: null,
    replyToId: null,
    outdated: false,
    viewerDidAuthor: false,
    viewerCanDelete: false,
  };
}

function threadOf(id: string, comments: Comment[]): ReviewThread {
  return {
    id,
    prId: 'pr',
    anchor: {
      path: 'a.ts',
      subjectType: 'LINE',
      side: 'RIGHT',
      line: 1,
      startLine: null,
      startSide: null,
      originalLine: null,
      originalStartLine: null,
      commitOid: null,
      originalCommitOid: null,
    },
    isResolved: false,
    isOutdated: false,
    comments,
  };
}

describe('sortThreadsChronologically', () => {
  it('orders threads by their root comment time, earliest first', () => {
    const late = threadOf('t-late', [timedComment('c1', '2026-01-02T00:00:00Z')]);
    const early = threadOf('t-early', [timedComment('c2', '2026-01-01T00:00:00Z')]);

    expect(sortThreadsChronologically([late, early]).map((t) => t.id)).toEqual([
      't-early',
      't-late',
    ]);
  });

  it('keeps a thread’s replies in place (schema order), only reordering threads', () => {
    const replies = [
      timedComment('root', '2026-01-01T00:00:00Z'),
      timedComment('reply-1', '2026-01-01T00:05:00Z'),
      timedComment('reply-2', '2026-01-01T00:10:00Z'),
    ];
    const t = threadOf('t1', replies);

    expect(sortThreadsChronologically([t])[0].comments.map((c) => c.id)).toEqual([
      'root',
      'reply-1',
      'reply-2',
    ]);
  });

  it('returns a new sorted array without mutating the input', () => {
    const a = threadOf('a', [timedComment('c1', '2026-01-02T00:00:00Z')]);
    const b = threadOf('b', [timedComment('c2', '2026-01-01T00:00:00Z')]);
    const input = [a, b];

    const sorted = sortThreadsChronologically(input);

    expect(sorted.map((t) => t.id)).toEqual(['b', 'a']);
    expect(input.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

function subjectThread(subjectType: 'PR' | 'LINE', body: string, refPath?: string): ReviewThread {
  const base = threadOf(body, [
    {
      ...timedComment(body, '2026-01-01T00:00:00Z'),
      body,
      local: refPath
        ? {
            status: 'new',
            updatedAt: '2026-01-01T00:00:00Z',
            references: [{ path: refPath, line: 1, kind: 'symbol' }],
          }
        : undefined,
    },
  ]);
  return { ...base, anchor: { ...base.anchor, subjectType } };
}

describe('fileReference', () => {
  it('points at the first line of the file', () => {
    expect(fileReference('a/b.ts')).toEqual({ path: 'a/b.ts', line: 1, kind: 'symbol' });
  });
});

describe('prThreadsReferencingFile', () => {
  it('matches local references and synced body lines of PR comment threads only', () => {
    const local = subjectThread('PR', 'local', 'a.ts');
    const synced = subjectThread('PR', 'hi\n\na.ts:1');
    const other = subjectThread('PR', 'hi\n\nb.ts:1');
    const prefixOnly = subjectThread('PR', 'a.ts:1x');
    const lineThread = subjectThread('LINE', 'x', 'a.ts');
    expect(
      prThreadsReferencingFile([local, synced, other, prefixOnly, lineThread], 'a.ts'),
    ).toEqual([local, synced]);
  });
});
