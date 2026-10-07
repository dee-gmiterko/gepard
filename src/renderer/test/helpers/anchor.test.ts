import { describe, expect, it } from 'vitest';
import { refAnchorFromDraft, refAnchorFromThread } from '../../src/helpers/anchor';
import type { Anchor, DraftAnchor } from '@gepard/common';

const checkoutHead = { base: 'base-sha', head: 'head-sha' };

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

describe('refAnchorFromThread', () => {
  it('resolves a right-side anchor against the head', () => {
    expect(refAnchorFromThread(anchor({}), checkoutHead)).toEqual({
      sha: 'head-sha',
      path: 'a.ts',
      line: 5,
      symbolsResolvable: true,
    });
  });

  it('uses the base for the left side and the original line when line is missing', () => {
    expect(refAnchorFromThread(anchor({ side: 'LEFT', line: null }), checkoutHead)).toMatchObject({
      sha: 'base-sha',
      line: 4,
      symbolsResolvable: false,
    });
  });

  it('is null without a checkoutHead, for another commit, or without any line', () => {
    expect(refAnchorFromThread(anchor({}), null)).toBeNull();
    expect(refAnchorFromThread(anchor({ commitOid: 'old' }), checkoutHead)).toBeNull();
    expect(
      refAnchorFromThread(anchor({ line: null, originalLine: null }), checkoutHead),
    ).toBeNull();
  });
});

describe('refAnchorFromDraft', () => {
  const draft = (patch: Partial<DraftAnchor>): DraftAnchor => ({
    path: 'a.ts',
    subjectType: 'LINE',
    side: 'RIGHT',
    line: 3,
    startLine: null,
    startSide: null,
    ...patch,
  });

  it('maps sides to base or head', () => {
    expect(refAnchorFromDraft(draft({}), checkoutHead)).toMatchObject({
      sha: 'head-sha',
      symbolsResolvable: true,
    });
    expect(refAnchorFromDraft(draft({ side: 'LEFT' }), checkoutHead)).toMatchObject({
      sha: 'base-sha',
      symbolsResolvable: false,
    });
  });

  it('is null without a line or checkoutHead', () => {
    expect(refAnchorFromDraft(draft({ line: null }), checkoutHead)).toBeNull();
    expect(refAnchorFromDraft(draft({}), null)).toBeNull();
  });
});
