// Latest-wins cancellation (src/main/ipc/cancellation.ts) and the
// search.run cancellation key (handlers/search.ts#searchRunKey): a newer
// request under the same key cancels the older one at once (its promise
// rejects with an AbortError, which ipc/registry.ts maps to CANCELLED, and its
// AbortSignal/CancellationToken fire), while requests under distinct keys —
// concurrent distinct searches — never cancel each other.
import { describe, expect, it } from 'vitest'
import { withLatestWins, type CancellableRun } from '../src/main/ipc/cancellation'
import { searchRunKey } from '../src/main/ipc/handlers/search'

/** A unit of work that stays pending until `resolve` is called, exposing the
 * signal/token it was handed. */
function deferredWork<T>(): {
  fn: (run: CancellableRun) => Promise<T>
  run: () => CancellableRun
  resolve: (value: T) => void
} {
  let captured: CancellableRun | undefined
  let resolveFn: (value: T) => void = () => undefined
  return {
    fn: (run) => {
      captured = run
      return new Promise<T>((resolve) => {
        resolveFn = resolve
      })
    },
    run: () => captured!,
    resolve: (value) => resolveFn(value)
  }
}

describe('withLatestWins', () => {
  it('cancels the in-flight call under the same key immediately', async () => {
    const first = deferredWork<string>()
    const second = deferredWork<string>()

    const p1 = withLatestWins('k-same', first.fn)
    const p2 = withLatestWins('k-same', second.fn)

    // Superseded: rejects with AbortError without the first work ever settling.
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' })
    expect(first.run().signal.aborted).toBe(true)
    expect(first.run().token.isCancellationRequested).toBe(true)
    expect(second.run().signal.aborted).toBe(false)
    expect(second.run().token.isCancellationRequested).toBe(false)

    second.resolve('second')
    await expect(p2).resolves.toBe('second')
  })

  it('does not cancel calls under distinct keys', async () => {
    const a = deferredWork<string>()
    const b = deferredWork<string>()

    const pa = withLatestWins('k-a', a.fn)
    const pb = withLatestWins('k-b', b.fn)

    expect(a.run().signal.aborted).toBe(false)
    b.resolve('b')
    a.resolve('a')
    await expect(pa).resolves.toBe('a')
    await expect(pb).resolves.toBe('b')
  })

  it('does not cancel a later call once the earlier one has settled', async () => {
    const first = deferredWork<number>()
    const p1 = withLatestWins('k-seq', first.fn)
    first.resolve(1)
    await expect(p1).resolves.toBe(1)

    const second = deferredWork<number>()
    const p2 = withLatestWins('k-seq', second.fn)
    expect(second.run().signal.aborted).toBe(false)
    second.resolve(2)
    await expect(p2).resolves.toBe(2)
  })

  it('propagates a real failure unchanged', async () => {
    const err = new Error('boom')
    await expect(withLatestWins('k-fail', () => Promise.reject(err))).rejects.toBe(err)
  })
})

describe('searchRunKey', () => {
  const base = { projectId: 'p', scope: 'all' as const }

  it('gives the side-panel pattern search one slot (latest-wins per keystroke)', () => {
    expect(searchRunKey({ ...base, kind: 'pattern', text: 'ab', word: false })).toBe(
      searchRunKey({ ...base, kind: 'pattern', text: 'abc', word: false })
    )
  })

  it('keeps "Same pattern in" for different symbols (two open editors) apart', () => {
    expect(searchRunKey({ ...base, kind: 'pattern', text: 'foo', word: true })).not.toBe(
      searchRunKey({ ...base, kind: 'pattern', text: 'bar', word: true })
    )
  })

  it('keeps the side panel apart from "Same pattern in" on the same text', () => {
    expect(searchRunKey({ ...base, kind: 'pattern', text: 'foo', word: false })).not.toBe(
      searchRunKey({ ...base, kind: 'pattern', text: 'foo', word: true })
    )
  })

  it('keys "Also in" by its anchor', () => {
    const at = (line: number): string =>
      searchRunKey({ ...base, kind: 'exactLine', text: 'x', origin: { path: 'a.ts', line } })
    expect(at(1)).not.toBe(at(2))
  })

  it('keys references by symbol position', () => {
    const at = (col: number): string =>
      searchRunKey({
        ...base,
        kind: 'references',
        text: 'x',
        at: { path: 'a.ts', pos: { line: 1, col } }
      })
    expect(at(1)).not.toBe(at(5))
  })

  it('keeps different projects apart', () => {
    expect(searchRunKey({ ...base, kind: 'regex', text: 'a' })).not.toBe(
      searchRunKey({ ...base, projectId: 'q', kind: 'regex', text: 'a' })
    )
  })
})
