import { describe, expect, it } from 'vitest'
import { CrashGate } from '../src/main/lsp/crash-gate'

describe('CrashGate.crash', () => {
  it('reports true the first time, false for any further call on the same incarnation', () => {
    const gate = new CrashGate()
    expect(gate.crash()).toBe(true)
    expect(gate.crash()).toBe(false)
    expect(gate.crash()).toBe(false)
  })

  it('reports true again after reset() (a new incarnation, e.g. after a restart)', () => {
    const gate = new CrashGate()
    expect(gate.crash()).toBe(true)
    gate.reset()
    expect(gate.crash()).toBe(true)
  })
})

describe('CrashGate.guard', () => {
  it('resolves normally when the work settles before any crash', async () => {
    const gate = new CrashGate()
    await expect(gate.guard(Promise.resolve('ok'))).resolves.toBe('ok')
  })

  it('rejects a request still pending when the incarnation crashes, with an AbortError', async () => {
    const gate = new CrashGate()
    const pending = new Promise<string>(() => {})
    const guarded = gate.guard(pending)
    gate.crash()
    await expect(guarded).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects every request in flight, not just one', async () => {
    const gate = new CrashGate()
    const never = (): Promise<never> => new Promise(() => {})
    const a = gate.guard(never())
    const b = gate.guard(never())
    gate.crash()
    await expect(a).rejects.toMatchObject({ name: 'AbortError' })
    await expect(b).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not reject a request started on a fresh incarnation after reset()', async () => {
    const gate = new CrashGate()
    gate.crash()
    gate.reset()

    await expect(gate.guard(Promise.resolve('after restart'))).resolves.toBe('after restart')
  })

  it('leaves a request from a previous, already-crashed incarnation rejected even after reset()', async () => {
    const gate = new CrashGate()
    const stale = new Promise<string>(() => {})
    const guarded = gate.guard(stale)
    gate.crash()
    gate.reset()

    await expect(guarded).rejects.toMatchObject({ name: 'AbortError' })
  })
})
