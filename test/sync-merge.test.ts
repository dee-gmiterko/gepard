// Pure unit tests for sync.ts's timestamp-merge rules (report 01 §8) and
// body composition — plain ReviewThread/Comment/LocalViewedState objects in,
// no `gh` process, no filesystem. This is where the real risk lives: the
// push/pull plumbing around it is thin glue over gh.ts and store/review.ts.
import { describe, expect, it } from 'vitest'
import { composeBody, mergeThreads, mergeViewed } from '../src/main/services/sync'
import type {
  Comment,
  LocalViewedState,
  RemoteViewedFile,
  ReviewThread
} from '@shared/ipc/schemas/comment'

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    databaseId: null,
    threadId: 'PRRT_1',
    reviewId: null,
    reviewState: null,
    author: { login: 'alice', isBot: false },
    body: 'body',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastEditedAt: null,
    replyToId: null,
    url: null,
    outdated: false,
    viewerDidAuthor: false,
    viewerCanDelete: false,
    ...overrides
  }
}

function makeThread(
  overrides: Partial<ReviewThread> & { id: string; comments: Comment[] }
): ReviewThread {
  return {
    prId: 'PR_1',
    anchor: {
      path: 'a.ts',
      subjectType: 'LINE',
      side: 'RIGHT',
      line: 1,
      startLine: null,
      startSide: null,
      originalLine: 1,
      originalStartLine: null,
      commitOid: '1111111111111111111111111111111111111111',
      originalCommitOid: '1111111111111111111111111111111111111111'
    },
    isResolved: false,
    isOutdated: false,
    remoteUpdatedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('composeBody', () => {
  it('returns the raw body unchanged when there are no references', () => {
    const comment = makeComment({ id: 'c1', body: 'plain comment' })
    expect(composeBody(comment)).toBe('plain comment')
  })

  it('appends one "path:line" reference per line, newline-separated', () => {
    const comment = makeComment({
      id: 'c1',
      body: 'see this',
      local: {
        status: 'new',
        updatedAt: '2024-01-01T00:00:00Z',
        references: [
          { path: 'src/a.ts', line: 5, kind: 'exact' },
          { path: 'src/b.ts', line: 9, kind: 'symbol' }
        ]
      }
    })
    expect(composeBody(comment)).toBe('see this\n\nsrc/a.ts:5\nsrc/b.ts:9')
  })

  it('dedupes identical references', () => {
    const comment = makeComment({
      id: 'c1',
      body: 'dup refs',
      local: {
        status: 'new',
        updatedAt: '2024-01-01T00:00:00Z',
        references: [
          { path: 'src/a.ts', line: 5, kind: 'exact' },
          { path: 'src/a.ts', line: 5, kind: 'pattern' }
        ]
      }
    })
    expect(composeBody(comment)).toBe('dup refs\n\nsrc/a.ts:5')
  })
})

describe('mergeThreads', () => {
  it('keeps local drafts (a new thread and a new reply) the remote has not seen yet', () => {
    const draftThread = makeThread({
      id: 'local:new-thread',
      local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [
        makeComment({
          id: 'local:new-comment',
          local: { status: 'new', updatedAt: '2024-01-01T00:00:00Z', references: [] }
        })
      ]
    })
    const syncedThread = makeThread({
      id: 'PRRT_1',
      comments: [
        makeComment({ id: 'PRRC_1' }),
        makeComment({
          id: 'local:new-reply',
          replyToId: 'PRRC_1',
          local: { status: 'new', updatedAt: '2024-01-01T00:01:00Z', references: [] }
        })
      ]
    })
    const remoteThread = makeThread({ id: 'PRRT_1', comments: [makeComment({ id: 'PRRC_1' })] })

    const result = mergeThreads([draftThread, syncedThread], [remoteThread])

    expect(result.find((t) => t.id === 'local:new-thread')).toBe(draftThread)
    const merged = result.find((t) => t.id === 'PRRT_1')!
    expect(merged.comments.map((c) => c.id).sort()).toEqual(['PRRC_1', 'local:new-reply'])
  })

  it('lets a newer remote edit win, inserts new remote comments, and drops ones missing from remote', () => {
    const local = makeThread({
      id: 'PRRT_2',
      comments: [
        makeComment({
          id: 'C1',
          body: 'old body',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }),
        makeComment({
          id: 'C2',
          body: 'still here?',
          createdAt: '2024-01-01T00:01:00Z',
          updatedAt: '2024-01-01T00:01:00Z'
        })
      ]
    })
    const remote = makeThread({
      id: 'PRRT_2',
      comments: [
        // C1 edited remotely (newer updatedAt) -> remote wins.
        makeComment({
          id: 'C1',
          body: 'new body',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        }),
        // C2 is gone (deleted remotely) -> dropped, not carried over.
        // C3 is new on the remote -> inserted.
        makeComment({
          id: 'C3',
          body: 'brand new',
          createdAt: '2024-01-01T00:02:00Z',
          updatedAt: '2024-01-01T00:02:00Z'
        })
      ]
    })

    const [merged] = mergeThreads([local], [remote])
    const byId = new Map(merged.comments.map((c) => [c.id, c]))
    expect(byId.get('C1')?.body).toBe('new body')
    expect(byId.has('C2')).toBe(false)
    expect(byId.get('C3')?.body).toBe('brand new')
  })

  it('keeps an unchanged local copy when the remote copy is not newer', () => {
    const local = makeThread({
      id: 'PRRT_3',
      comments: [makeComment({ id: 'C1', body: 'local wins', updatedAt: '2024-01-02T00:00:00Z' })]
    })
    const remote = makeThread({
      id: 'PRRT_3',
      comments: [makeComment({ id: 'C1', body: 'stale remote', updatedAt: '2024-01-01T00:00:00Z' })]
    })
    const [merged] = mergeThreads([local], [remote])
    expect(merged.comments[0].body).toBe('local wins')
  })

  it('drops a synced thread missing from the remote, but keeps one pending local deletion', () => {
    const deletedRemotely = makeThread({ id: 'PRRT_gone', comments: [makeComment({ id: 'C1' })] })
    const pendingDelete = makeThread({
      id: 'PRRT_pending',
      local: { status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' },
      comments: [makeComment({ id: 'C2' })]
    })
    const remoteStillHasPendingDelete = makeThread({
      id: 'PRRT_pending',
      comments: [makeComment({ id: 'C2' })]
    })

    const result = mergeThreads([deletedRemotely, pendingDelete], [remoteStillHasPendingDelete])

    expect(result.find((t) => t.id === 'PRRT_gone')).toBeUndefined()
    const kept = result.find((t) => t.id === 'PRRT_pending')!
    expect(kept.local).toEqual({ status: 'deleted', updatedAt: '2024-01-01T00:00:00Z' })
  })
})

describe('mergeViewed', () => {
  function remoteFile(
    path: string,
    state: RemoteViewedFile['viewerViewedState']
  ): RemoteViewedFile {
    return { path, additions: 1, deletions: 0, changeType: 'MODIFIED', viewerViewedState: state }
  }

  it('inserts an unseen remote row, turning DISMISSED into viewed: false', () => {
    const result = mergeViewed([], [remoteFile('a.ts', 'DISMISSED')], 'PR_1', null)
    expect(result).toEqual([
      {
        prId: 'PR_1',
        path: 'a.ts',
        viewed: false,
        remote: 'DISMISSED',
        localUpdatedAt: null,
        remoteFetchedAt: expect.any(String)
      }
    ])
  })

  it('lets the remote decide when the local row was never touched', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'b.ts',
        viewed: false,
        remote: null,
        localUpdatedAt: null,
        remoteFetchedAt: null
      }
    ]
    const [row] = mergeViewed(local, [remoteFile('b.ts', 'VIEWED')], 'PR_1', null)
    expect(row.viewed).toBe(true)
    expect(row.remote).toBe('VIEWED')
  })

  it('keeps an unpushed local change across a pull (never synced yet)', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'c.ts',
        viewed: true,
        remote: null,
        localUpdatedAt: '2024-01-01T00:00:00Z',
        remoteFetchedAt: null
      }
    ]
    // lastSuccessfulSyncAt: null -> "never synced" -> local always wins.
    const [row] = mergeViewed(local, [remoteFile('c.ts', 'UNVIEWED')], 'PR_1', null)
    expect(row.viewed).toBe(true) // survives the pull
    expect(row.remote).toBe('UNVIEWED') // last-known remote value still recorded
    expect(row.localUpdatedAt).toBe('2024-01-01T00:00:00Z') // untouched
  })

  it('lets the remote win once the local change is older than the last successful sync', () => {
    const local: LocalViewedState[] = [
      {
        prId: 'PR_1',
        path: 'd.ts',
        viewed: true,
        remote: 'VIEWED',
        localUpdatedAt: '2024-01-01T00:00:00Z',
        remoteFetchedAt: '2024-01-01T00:00:00Z'
      }
    ]
    const [row] = mergeViewed(
      local,
      [remoteFile('d.ts', 'DISMISSED')],
      'PR_1',
      '2024-01-02T00:00:00Z'
    )
    expect(row.viewed).toBe(false)
    expect(row.remote).toBe('DISMISSED')
  })
})
