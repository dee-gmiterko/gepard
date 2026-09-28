import { describe, expect, it } from 'vitest';
import { codeViewCommentEntries } from '../src/components/CodeEditor/commentWidgets';
import type { Comment, ReviewThread } from '@gepard/common/ipc/schemas/comment';

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
