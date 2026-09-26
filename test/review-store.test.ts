// store/review.ts is the only code allowed to touch review/<pr>.json (report
// 04 §4.3): read-at-open, atomic write-tmp-then-rename, in-memory cache, and
// the local-only comment/viewed mutations that Sync (tested separately, as
// pure merge rules in sync-merge.test.ts) later pushes. Exercised here
// against a real temp directory through the electron mock.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { __setUserDataDir } from './support/electron'
import { makeTmpDir, type TmpDir } from './support/tmp'
import * as review from '../src/main/store/review'

describe('store/review', () => {
  let userData: TmpDir

  beforeAll(async () => {
    userData = await makeTmpDir('review-store')
    __setUserDataDir(userData.path)
  })

  afterAll(async () => {
    await userData.cleanup()
  })

  const ctx = {
    prId: 'PR_1',
    headRefOid: '1111111111111111111111111111111111111111',
    viewerLogin: 'tester'
  }

  it('loadReview returns an empty store when no file exists yet, and saveReview round-trips it', async () => {
    const empty = await review.loadReview('proj-a', 1)
    expect(empty).toEqual({ threads: [], viewed: [], lastSuccessfulSyncAt: null })

    await review.saveReview('proj-a', 1, {
      threads: [],
      viewed: [],
      lastSuccessfulSyncAt: '2024-01-01T00:00:00Z'
    })
    // Force a re-read from disk (loadReview would otherwise serve the cache).
    const reloaded = await review.loadReview('proj-a', 2)
    expect(reloaded.lastSuccessfulSyncAt).toBeNull() // different pr, still empty

    const roundTripped = await review.loadReview('proj-a', 1)
    expect(roundTripped.lastSuccessfulSyncAt).toBe('2024-01-01T00:00:00Z')
  })

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
        startSide: null
      },
      body: 'root comment',
      references: [{ path: 'src/x.ts', line: 5, kind: 'exact' }]
    })
    expect(root.local?.status).toBe('new')
    expect(root.id.startsWith('local:')).toBe(true)

    const reply = await review.upsertLocalComment('proj-b', 10, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      body: 'a reply',
      references: []
    })
    expect(reply.threadId).toBe(root.threadId)
    expect(reply.replyToId).toBe(root.id)

    const edited = await review.upsertLocalComment('proj-b', 10, ctx, {
      id: root.id,
      threadId: null,
      anchor: null,
      body: 'edited root comment',
      references: []
    })
    expect(edited.body).toBe('edited root comment')
    expect(edited.local?.references).toEqual([])

    const threads = await review.listThreads('proj-b', 10)
    expect(threads).toHaveLength(1)
    expect(threads[0].comments.map((c) => c.body)).toEqual(['edited root comment', 'a reply'])
  })

  it('rejects editing a comment that is no longer a local draft', async () => {
    const root = await review.upsertLocalComment('proj-c', 20, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'a.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 1,
        startLine: null,
        startSide: null
      },
      body: 'root',
      references: []
    })
    // Simulate what Sync does once pushed: clear the `local` marker directly.
    const store = await review.loadReview('proj-c', 20)
    store.threads[0].comments[0].local = undefined
    store.threads[0].local = undefined
    await review.saveReview('proj-c', 20, store)

    await expect(
      review.upsertLocalComment('proj-c', 20, ctx, {
        id: root.id,
        threadId: null,
        anchor: null,
        body: 'too late',
        references: []
      })
    ).rejects.toThrow()
  })

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
        startSide: null
      },
      body: 'root',
      references: []
    })
    const reply = await review.upsertLocalComment('proj-d', 30, ctx, {
      id: null,
      threadId: root.threadId,
      anchor: null,
      body: 'reply',
      references: []
    })

    // Deleting a brand-new (never-synced) reply removes it outright.
    await review.deleteLocalComment('proj-d', 30, reply.id)
    let store = await review.loadReview('proj-d', 30)
    expect(store.threads[0].comments).toHaveLength(1)

    // Deleting a brand-new root removes the whole thread.
    await review.deleteLocalComment('proj-d', 30, root.id)
    store = await review.loadReview('proj-d', 30)
    expect(store.threads).toHaveLength(0)

    // A synced thread's root is instead marked pending deletion.
    const syncedRoot = await review.upsertLocalComment('proj-d', 31, ctx, {
      id: null,
      threadId: null,
      anchor: {
        path: 'b.ts',
        subjectType: 'LINE',
        side: 'RIGHT',
        line: 2,
        startLine: null,
        startSide: null
      },
      body: 'synced root',
      references: []
    })
    store = await review.loadReview('proj-d', 31)
    store.threads[0].local = undefined
    store.threads[0].comments[0].local = undefined
    await review.saveReview('proj-d', 31, store)

    await review.deleteLocalComment('proj-d', 31, syncedRoot.id)
    store = await review.loadReview('proj-d', 31)
    expect(store.threads[0].local).toEqual({ status: 'deleted', updatedAt: expect.any(String) })
    // listThreads hides threads pending deletion from the UI.
    expect(await review.listThreads('proj-d', 31)).toEqual([])
  })

  it('setLocalViewed batches multiple paths and updates an existing row', async () => {
    const rows = await review.setLocalViewed('proj-e', 40, 'PR_E', ['a.ts', 'b.ts'], true)
    expect(rows.map((r) => r.path).sort()).toEqual(['a.ts', 'b.ts'])
    expect(rows.every((r) => r.viewed)).toBe(true)

    const updated = await review.setLocalViewed('proj-e', 40, 'PR_E', ['a.ts'], false)
    const aRow = updated.find((r) => r.path === 'a.ts')!
    const bRow = updated.find((r) => r.path === 'b.ts')!
    expect(aRow.viewed).toBe(false)
    expect(bRow.viewed).toBe(true) // untouched by the second call
  })
})
