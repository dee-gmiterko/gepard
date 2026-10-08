import { describe, expect, it } from 'vitest';
import {
  anchorReference,
  composeIssueDescription,
  countComments,
  generalCommentAnchor,
} from '../../helpers/comment';
import type { Anchor, CommentReference, ReviewThread } from '../../ipc/schemas/comment';

describe('generalCommentAnchor', () => {
  it('anchors to the PR with no path or lines', () => {
    const anchor = generalCommentAnchor();
    expect(anchor).toMatchObject({ path: '', subjectType: 'PR', side: 'RIGHT', line: null });
    expect(anchor.commitOid).toBeNull();
  });

  it('returns a new object each call', () => {
    expect(generalCommentAnchor()).not.toBe(generalCommentAnchor());
  });
});

function thread(
  id: string,
  anchor: Partial<Anchor>,
  comments: { body: string; createdAt: string; references?: CommentReference[] }[],
): ReviewThread {
  return {
    id,
    prId: 'unassigned',
    anchor: { ...generalCommentAnchor(), ...anchor },
    isResolved: false,
    isOutdated: false,
    comments: comments.map((c, i) => ({
      id: `${id}-${i}`,
      threadId: id,
      reviewId: null,
      reviewState: null,
      author: null,
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      lastEditedAt: null,
      replyToId: null,
      outdated: false,
      viewerDidAuthor: true,
      viewerCanDelete: true,
      local: { status: 'new', updatedAt: c.createdAt, references: c.references ?? [] },
    })),
  };
}

describe('anchorReference', () => {
  it('has no reference for a global comment', () => {
    expect(anchorReference(generalCommentAnchor())).toBeNull();
  });

  it('references the path of a file comment', () => {
    expect(anchorReference({ ...generalCommentAnchor(), path: 'a.ts', subjectType: 'FILE' })).toBe(
      'a.ts',
    );
  });

  it('references the path and line, or line range, of a line comment', () => {
    const line = { ...generalCommentAnchor(), path: 'a.ts', subjectType: 'LINE' as const, line: 7 };
    expect(anchorReference(line)).toBe('a.ts:7');
    expect(anchorReference({ ...line, startLine: 3 })).toBe('a.ts:3-7');
  });
});

describe('composeIssueDescription', () => {
  it('joins comments in creation order with a blank line, each prefixed with its reference', () => {
    const description = composeIssueDescription([
      thread('t2', { path: 'src/a.ts', subjectType: 'LINE', line: 4 }, [
        { body: 'line note', createdAt: '2026-01-02T00:00:00Z' },
      ]),
      thread('t1', {}, [{ body: '  global note  ', createdAt: '2026-01-01T00:00:00Z' }]),
      thread('t3', { path: 'README.md', subjectType: 'FILE' }, [
        { body: 'file note', createdAt: '2026-01-03T00:00:00Z' },
        { body: 'a reply', createdAt: '2026-01-04T00:00:00Z' },
      ]),
    ]);
    expect(description).toBe(
      'global note\n\nsrc/a.ts:4\nline note\n\nREADME.md\nfile note\n\na reply',
    );
  });

  it('appends the extra references a comment carries', () => {
    const description = composeIssueDescription([
      thread('t1', {}, [
        {
          body: 'see these',
          createdAt: '2026-01-01T00:00:00Z',
          references: [
            { path: 'b.ts', line: 2, kind: 'exact' },
            { path: 'b.ts', line: 2, kind: 'symbol' },
          ],
        },
      ]),
    ]);
    expect(description).toBe('see these\nb.ts:2');
  });

  it('is empty without comments', () => {
    expect(composeIssueDescription([])).toBe('');
  });
});

describe('countComments', () => {
  it('counts replies as well as thread roots', () => {
    const t = thread('t', {}, [
      { body: 'a', createdAt: '2026-01-01T00:00:00Z' },
      { body: 'b', createdAt: '2026-01-02T00:00:00Z' },
    ]);
    const u = thread('u', {}, [{ body: 'c', createdAt: '2026-01-03T00:00:00Z' }]);
    expect(countComments([t, u])).toBe(3);
  });
});
