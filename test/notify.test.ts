// Pure-function tests for notify.ts: the decision/formatting logic behind
// forwarding main-process failures that are not the result of a renderer
// request to the toast surface (coordinator spec: logged once, shown once).
// No Electron, no filesystem — notifyMainFailure itself (which logs and
// emits) needs Electron and is not covered here; we only cover the pure
// pieces new to this change.
import { describe, expect, it } from 'vitest'
import { AppErrorGate, formatCaughtError, isNotifiableLevel } from '../src/main/notify'

describe('isNotifiableLevel', () => {
  it('is true only for error', () => {
    expect(isNotifiableLevel('error')).toBe(true)
  })

  it('is false for warn and info (log-only, not a toast-worthy failure)', () => {
    expect(isNotifiableLevel('warn')).toBe(false)
    expect(isNotifiableLevel('info')).toBe(false)
  })
})

describe('formatCaughtError', () => {
  it('prefers an Error stack over its message', () => {
    const err = new Error('boom')
    expect(formatCaughtError(err)).toBe(err.stack)
  })

  it('falls back to the message when the stack is missing', () => {
    const err = new Error('boom')
    err.stack = undefined
    expect(formatCaughtError(err)).toBe('boom')
  })

  it('stringifies a non-Error rejection reason (e.g. a thrown string or object)', () => {
    expect(formatCaughtError('just a string')).toBe('just a string')
    expect(formatCaughtError(42)).toBe('42')
    expect(formatCaughtError({ code: 'X' })).toBe('[object Object]')
  })
})

// AppErrorGate: the gap-1 fix. `emit` (registry.ts) only reaches windows that
// exist right now, over a listener the renderer has already registered — a
// fire-and-forget push, not a queue — so a failure before any window exists,
// or before that window's renderer has subscribed, must be buffered instead
// of dropped, then delivered exactly once when the renderer becomes ready.
describe('AppErrorGate', () => {
  const payload = (n: number): { scope: string; message: string } => ({
    scope: `s${n}`,
    message: `m${n}`
  })

  it('buffers notifications before the gate is opened, delivering nothing yet', () => {
    const gate = new AppErrorGate()
    expect(gate.notify(payload(1))).toEqual([])
    expect(gate.notify(payload(2))).toEqual([])
  })

  it('flushes everything buffered, in order, exactly once when opened', () => {
    const gate = new AppErrorGate()
    gate.notify(payload(1))
    gate.notify(payload(2))
    expect(gate.open()).toEqual([payload(1), payload(2)])
    // A second open() (e.g. a dev-mode reload's second did-finish-load) must
    // not re-deliver anything.
    expect(gate.open()).toEqual([])
  })

  it('delivers immediately once open, without buffering', () => {
    const gate = new AppErrorGate()
    gate.open()
    expect(gate.notify(payload(1))).toEqual([payload(1)])
    expect(gate.open()).toEqual([]) // nothing left buffered
  })

  it('is a no-op to open an already-empty, never-notified gate', () => {
    const gate = new AppErrorGate()
    expect(gate.open()).toEqual([])
  })
})
