import { describe, expect, it } from 'vitest';
import { refAnchorFromDraft, refAnchorFromThread } from '../src/helpers/anchor';
import { diffViewCommentEntries } from '../src/helpers/comment';
import type { Anchor, DraftAnchor, ReviewThread } from '@gepard/common';

const checkout = { base: 'base-sha', head: 'head-sha' };

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
    expect(refAnchorFromThread(anchor({}), checkout)).toEqual({
      sha: 'head-sha',
      path: 'a.ts',
      line: 5,
      symbolsResolvable: true,
    });
  });

  it('uses the base for the left side and the original line when line is missing', () => {
    expect(refAnchorFromThread(anchor({ side: 'LEFT', line: null }), checkout)).toMatchObject({
      sha: 'base-sha',
      line: 4,
      symbolsResolvable: false,
    });
  });

  it('is null without a checkout, for another commit, or without any line', () => {
    expect(refAnchorFromThread(anchor({}), null)).toBeNull();
    expect(refAnchorFromThread(anchor({ commitOid: 'old' }), checkout)).toBeNull();
    expect(refAnchorFromThread(anchor({ line: null, originalLine: null }), checkout)).toBeNull();
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
    expect(refAnchorFromDraft(draft({}), checkout)).toMatchObject({
      sha: 'head-sha',
      symbolsResolvable: true,
    });
    expect(refAnchorFromDraft(draft({ side: 'LEFT' }), checkout)).toMatchObject({
      sha: 'base-sha',
      symbolsResolvable: false,
    });
  });

  it('is null without a line or checkout', () => {
    expect(refAnchorFromDraft(draft({ line: null }), checkout)).toBeNull();
    expect(refAnchorFromDraft(draft({}), null)).toBeNull();
  });
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
