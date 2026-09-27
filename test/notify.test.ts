import { describe, expect, it } from 'vitest'
import { AppErrorGate } from '../src/main/notify'

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
})
