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

// IPC `emit` only reaches windows and renderer listeners that already exist;
// it is a fire-and-forget push, not a queue.
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
    expect(gate.open()).toEqual([])
  })

  it('delivers immediately once open, without buffering', () => {
    const gate = new AppErrorGate()
    gate.open()
    expect(gate.notify(payload(1))).toEqual([payload(1)])
    expect(gate.open()).toEqual([])
  })

  it('is a no-op to open an already-empty, never-notified gate', () => {
    const gate = new AppErrorGate()
    expect(gate.open()).toEqual([])
  })
})
