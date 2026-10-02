import { describe, expect, it } from 'vitest';
import { generalCommentAnchor } from '@gepard/common';

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
