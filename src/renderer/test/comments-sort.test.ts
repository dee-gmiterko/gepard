import { describe, expect, it } from 'vitest';
import { sortThreadsChronologically } from '../src/features/content/comments/sortThreads';
import type { Comment, ReviewThread } from '@gepard/common/ipc/schemas/comment';

function comment(id: string, createdAt: string): Comment {
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

function thread(id: string, comments: Comment[]): ReviewThread {
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
    const late = thread('t-late', [comment('c1', '2026-01-02T00:00:00Z')]);
    const early = thread('t-early', [comment('c2', '2026-01-01T00:00:00Z')]);

    expect(sortThreadsChronologically([late, early]).map((t) => t.id)).toEqual([
      't-early',
      't-late',
    ]);
  });

  it('keeps a thread’s replies in place (schema order), only reordering threads', () => {
    const replies = [
      comment('root', '2026-01-01T00:00:00Z'),
      comment('reply-1', '2026-01-01T00:05:00Z'),
      comment('reply-2', '2026-01-01T00:10:00Z'),
    ];
    const t = thread('t1', replies);

    expect(sortThreadsChronologically([t])[0].comments.map((c) => c.id)).toEqual([
      'root',
      'reply-1',
      'reply-2',
    ]);
  });

  it('returns a new sorted array without mutating the input', () => {
    const a = thread('a', [comment('c1', '2026-01-02T00:00:00Z')]);
    const b = thread('b', [comment('c2', '2026-01-01T00:00:00Z')]);
    const input = [a, b];

    const sorted = sortThreadsChronologically(input);

    expect(sorted.map((t) => t.id)).toEqual(['b', 'a']);
    expect(input.map((t) => t.id)).toEqual(['a', 'b']);
  });
});
