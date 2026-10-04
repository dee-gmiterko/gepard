import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';
import * as review from '../store/review';

describe('store/review', () => {
  let userData: TmpDir;

  beforeAll(async () => {
    userData = await makeTmpDir('review-store');
    __setUserDataDir(userData.path);
  });

  afterAll(async () => {
    await userData.cleanup();
  });

  const ctx = {
    prId: 'PR_1',
    commitOid: '1111111111111111111111111111111111111111',
  };

  it('loadReview returns an empty store when no file exists yet, and saveReview round-trips it', async () => {
    const empty = await review.loadReview('proj-a', 1);
    expect(empty).toEqual({
      threads: [],
      viewed: [],
      pendingReviewId: null,
      lastSuccessfulSyncAt: null,
    });

    await review.saveReview('proj-a', 1, {
      threads: [],
      viewed: [],
      pendingReviewId: null,
      lastSuccessfulSyncAt: '2024-01-01T00:00:00Z',
    });
    const reloaded = await review.loadReview('proj-a', 2);
    expect(reloaded.lastSuccessfulSyncAt).toBeNull();

    const roundTripped = await review.loadReview('proj-a', 1);
    expect(roundTripped.lastSuccessfulSyncAt).toBe('2024-01-01T00:00:00Z');
  });

  it('upsertLocalComment creates a new thread, replies to it, and edits a still-new draft', async () => {
    const root = await review.upsertLocalComment('proj-b', 10, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'src/x.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 5,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'root comment',
      references: [{ path: 'src/x.ts', line: 5, kind: 'exact' }],
    });
    expect(root.local?.status).toBe('new');
    expect(root.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const reply = await review.upsertLocalComment('proj-b', 10, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      general: false,
      body: 'a reply',
      references: [],
    });
    expect(reply.threadId).toBe(root.threadId);
    expect(reply.replyToId).toBe(root.id);

    const edited = await review.upsertLocalComment('proj-b', 10, ctx, {
      id: root.id,
      threadId: null,
      anchor: null,
      general: false,
      body: 'edited root comment',
      references: [],
    });
    expect(edited.body).toBe('edited root comment');
    expect(edited.local?.references).toEqual([]);

    const threads = await review.listThreads('proj-b', 10);
    expect(threads).toHaveLength(1);
    expect(threads[0].comments.map((c) => c.body)).toEqual(['edited root comment', 'a reply']);
  });

  it('allows editing a synced comment authored by the viewer, marking it edited', async () => {
    const root = await review.upsertLocalComment('proj-c', 20, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 1,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'root',
      references: [],
    });
    const store = await review.loadReview('proj-c', 20);
    store.threads[0].comments[0].local = undefined;
    store.threads[0].local = undefined;
    await review.saveReview('proj-c', 20, store);

    const edited = await review.upsertLocalComment('proj-c', 20, ctx, {
      id: root.id,
      threadId: null,
      anchor: null,
      general: false,
      body: 'edited after sync',
      references: [],
    });
    expect(edited.body).toBe('edited after sync');
    expect(edited.local?.status).toBe('edited');
  });

  it('rejects editing a comment marked for deletion', async () => {
    const root = await review.upsertLocalComment('proj-c', 21, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 1,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'root',
      references: [],
    });
    const store = await review.loadReview('proj-c', 21);
    store.threads[0].comments[0].local = undefined;
    store.threads[0].local = undefined;
    await review.saveReview('proj-c', 21, store);
    await review.deleteLocalComment('proj-c', 21, root.id);

    await expect(
      review.upsertLocalComment('proj-c', 21, ctx, {
        id: root.id,
        threadId: null,
        anchor: null,
        general: false,
        body: 'too late',
        references: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_EDITABLE' });
  });

  it('refuses to delete a synced thread root that still has a live reply', async () => {
    const root = await review.upsertLocalComment('proj-c', 22, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 1,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'root',
      references: [],
    });
    const reply = await review.upsertLocalComment('proj-c', 22, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      general: false,
      body: 'a reply',
      references: [],
    });
    let store = await review.loadReview('proj-c', 22);
    store.threads[0].local = undefined;
    store.threads[0].comments[0].local = undefined;
    store.threads[0].comments[1].local = undefined;
    await review.saveReview('proj-c', 22, store);

    await expect(review.deleteLocalComment('proj-c', 22, root.id)).rejects.toMatchObject({
      code: 'NOT_DELETABLE',
    });

    await review.deleteLocalComment('proj-c', 22, reply.id);
    await review.deleteLocalComment('proj-c', 22, root.id);
    store = await review.loadReview('proj-c', 22);
    expect(store.threads[0].local?.status).toBe('deleted');
    expect(typeof store.threads[0].local?.updatedAt).toBe('string');
  });

  it('deleteLocalComment drops unsynced drafts outright and marks synced ones pending deletion', async () => {
    const root = await review.upsertLocalComment('proj-d', 30, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 1,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'root',
      references: [],
    });
    const reply = await review.upsertLocalComment('proj-d', 30, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      general: false,
      body: 'reply',
      references: [],
    });

    await review.deleteLocalComment('proj-d', 30, reply.id);
    let store = await review.loadReview('proj-d', 30);
    expect(store.threads[0].comments).toHaveLength(1);

    await review.deleteLocalComment('proj-d', 30, root.id);
    store = await review.loadReview('proj-d', 30);
    expect(store.threads).toHaveLength(0);

    const syncedRoot = await review.upsertLocalComment('proj-d', 31, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'b.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 2,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'synced root',
      references: [],
    });
    store = await review.loadReview('proj-d', 31);
    store.threads[0].local = undefined;
    store.threads[0].comments[0].local = undefined;
    await review.saveReview('proj-d', 31, store);

    await review.deleteLocalComment('proj-d', 31, syncedRoot.id);
    store = await review.loadReview('proj-d', 31);
    expect(store.threads[0].local?.status).toBe('deleted');
    expect(typeof store.threads[0].local?.updatedAt).toBe('string');
    expect(await review.listThreads('proj-d', 31)).toEqual([]);
  });

  it('upsertLocalComment creates a general (anchor-less) PR comment, editable and deletable like any other', async () => {
    const root = await review.upsertLocalComment('proj-f', 50, ctx, {
      id: null,
      threadId: null,
      anchor: null,
      general: true,
      body: 'general comment',
      references: [],
    });
    expect(root.local?.status).toBe('new');

    const threads = await review.listThreads('proj-f', 50);
    expect(threads).toHaveLength(1);
    expect(threads[0].anchor).toMatchObject({ path: '', subjectType: 'PR', line: null });

    const edited = await review.upsertLocalComment('proj-f', 50, ctx, {
      id: root.id,
      threadId: null,
      anchor: null,
      general: false,
      body: 'edited general comment',
      references: [],
    });
    expect(edited.body).toBe('edited general comment');

    await review.deleteLocalComment('proj-f', 50, root.id);
    expect(await review.listThreads('proj-f', 50)).toEqual([]);
  });

  it('replies to a general PR comment thread the same way as a file-anchored one', async () => {
    const root = await review.upsertLocalComment('proj-f', 52, ctx, {
      id: null,
      threadId: null,
      anchor: null,
      general: true,
      body: 'general comment',
      references: [],
    });

    const reply = await review.upsertLocalComment('proj-f', 52, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      general: false,
      body: 'a reply to the general comment',
      references: [],
    });
    expect(reply.threadId).toBe(root.threadId);
    expect(reply.replyToId).toBe(root.id);
    expect(reply.local?.status).toBe('new');

    const threads = await review.listThreads('proj-f', 52);
    expect(threads).toHaveLength(1);
    expect(threads[0].anchor.subjectType).toBe('PR');
    expect(threads[0].comments.map((c) => c.body)).toEqual([
      'general comment',
      'a reply to the general comment',
    ]);
  });

  it('rejects a brand-new comment with neither an anchor nor the general flag', async () => {
    await expect(
      review.upsertLocalComment('proj-f', 51, ctx, {
        id: null,
        threadId: null,
        anchor: null,
        general: false,
        body: 'nowhere to go',
        references: [],
      }),
    ).rejects.toMatchObject({ code: 'BAD_INPUT' });
  });

  it('setLocalViewed batches multiple paths and updates an existing row', async () => {
    const rows = await review.setLocalViewed('proj-e', 40, 'PR_E', ['a.ts', 'b.ts'], true);
    expect(rows.map((r) => r.path).sort()).toEqual(['a.ts', 'b.ts']);
    expect(rows.every((r) => r.viewed)).toBe(true);

    const updated = await review.setLocalViewed('proj-e', 40, 'PR_E', ['a.ts'], false);
    expect(updated.find((r) => r.path === 'a.ts')?.viewed).toBe(false);
    expect(updated.find((r) => r.path === 'b.ts')?.viewed).toBe(true);
  });

  it('keeps unassigned comments apart from PR comments and clears selected threads', async () => {
    const unassignedCtx = { prId: review.UNASSIGNED_PR_ID, commitOid: ctx.commitOid };
    const general = await review.upsertLocalComment('proj-g', null, unassignedCtx, {
      id: null,
      threadId: null,
      anchor: null,
      general: true,
      body: 'global note',
      references: [],
    });
    const line = await review.upsertLocalComment('proj-g', null, unassignedCtx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'src/y.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 3,
        startLine: null,
        startSide: null,
      },
      general: false,
      body: 'line note',
      references: [],
    });
    await review.upsertLocalComment('proj-g', 1, ctx, {
      id: null,
      threadId: null,
      anchor: null,
      general: true,
      body: 'pr note',
      references: [],
    });

    const unassigned = await review.listThreads('proj-g', null);
    expect(unassigned.map((t) => t.comments[0].body)).toEqual(['global note', 'line note']);
    expect(unassigned.every((t) => t.prId === review.UNASSIGNED_PR_ID)).toBe(true);
    expect((await review.listThreads('proj-g', 1)).map((t) => t.comments[0].body)).toEqual([
      'pr note',
    ]);

    await review.clearUnassignedThreads('proj-g', [general.threadId]);
    expect((await review.listThreads('proj-g', null)).map((t) => t.id)).toEqual([line.threadId]);
    expect(await review.listThreads('proj-g', 1)).toHaveLength(1);

    await review.deleteLocalComment('proj-g', null, line.id);
    expect(await review.listThreads('proj-g', null)).toEqual([]);
  });
});
