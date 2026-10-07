import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTmpDir, type TmpDir } from './support/tmp';

type ReviewModule = typeof import('../store/review');
type CommentDraftInput = import('../store/review').CommentDraftInput;

describe('store/review shared by several app instances over one userData dir', () => {
  let userData: TmpDir;

  beforeEach(async () => {
    userData = await makeTmpDir('review-multi');
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  async function newInstance(): Promise<ReviewModule> {
    vi.resetModules();
    const mod = await import('../store/review');
    const electron = await import('./support/electron');
    electron.__setUserDataDir(userData.path);
    return mod;
  }

  const ctx = { prId: 'PR_1', commitOid: '1'.repeat(40) };
  const draft = (body: string): CommentDraftInput => ({
    id: null,
    threadId: null,
    anchor: {
      path: 'a.ts',
      subjectType: 'LINE' as const,
      side: 'RIGHT' as const,
      line: 1,
      startLine: null,
      startSide: null,
    },
    general: false,
    body,
    references: [],
  });
  const bodies = async (m: ReviewModule): Promise<string[]> =>
    (await m.loadReview('o__r', 1)).threads.flatMap((t) => t.comments.map((c) => c.body)).sort();

  it('a fresh instance reads what another instance persisted', async () => {
    const a = await newInstance();
    await a.upsertLocalComment('o__r', 1, ctx, draft('from A'));
    const b = await newInstance();
    expect(await bodies(b)).toEqual(['from A']);
  });

  it('sequential writes from one instance accumulate', async () => {
    const a = await newInstance();
    await a.upsertLocalComment('o__r', 1, ctx, draft('one'));
    await a.upsertLocalComment('o__r', 1, ctx, draft('two'));
    expect(await bodies(a)).toEqual(['one', 'two']);
  });

  it('does not drop a comment another instance added after this one loaded', async () => {
    const a = await newInstance();
    await a.loadReview('o__r', 1);
    const b = await newInstance();
    await b.upsertLocalComment('o__r', 1, ctx, draft('from B'));
    await a.upsertLocalComment('o__r', 1, ctx, draft('from A'));

    expect(await bodies(await newInstance())).toEqual(['from A', 'from B']);
  });

  it('does not drop viewed marks written by another instance', async () => {
    const a = await newInstance();
    await a.loadReview('o__r', 1);
    const b = await newInstance();
    await b.setLocalViewed('o__r', 1, 'PR_1', ['x.ts'], true);
    await a.setLocalViewed('o__r', 1, 'PR_1', ['y.ts'], true);

    const paths = (await (await newInstance()).listViewed('o__r', 1)).map((v) => v.path).sort();
    expect(paths).toEqual(['x.ts', 'y.ts']);
  });
});
