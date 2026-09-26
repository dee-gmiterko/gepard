// The only file that touches `window.ipc` (report 04 §2.5, §8, full listing).
import { useEffect, useLayoutEffect, useRef } from 'react'
import type {
  ChannelName,
  ChannelOutput,
  EventName,
  EventPayload,
  Envelope,
  InvokeArgs,
  IpcErrorShape
} from '@shared/ipc/contract'

export class IpcError extends Error {
  code: string
  details?: unknown
  /** The channel that failed; for the log line (errors/report.ts), since
   * main does not log failures it returns over IPC. */
  channel?: string
  constructor(shape: IpcErrorShape, channel?: string) {
    super(shape.message)
    this.name = 'IpcError'
    this.code = shape.code
    this.details = shape.details
    this.channel = channel
  }
}

/** True for a request superseded by a newer one under main's latest-wins
 * cancellation (`search.run`/`symbols.*`, coordinator cancellation spec) —
 * not a real failure, so callers should not surface it as an error. */
export function isCancelledError(error: unknown): boolean {
  return error instanceof IpcError && error.code === 'CANCELLED'
}

/** The only way the renderer talks to main. TanStack Query hooks call this. */
export async function invoke<C extends ChannelName>(
  channel: C,
  ...args: InvokeArgs<C>
): Promise<ChannelOutput<C>> {
  const res = (await window.ipc.invoke(channel, args[0])) as Envelope<ChannelOutput<C>>
  if (!res.ok) throw new IpcError(res.error, channel)
  return res.value
}

export function subscribe<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void
): () => void {
  return window.ipc.on(event, (raw) => cb(raw as EventPayload<E>))
}

/** React hook form; `cb` may change every render, subscription does not. */
export function useIpcEvent<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void
): void {
  const ref = useRef(cb)
  useLayoutEffect(() => {
    ref.current = cb
  })
  useEffect(() => subscribe(event, (p) => ref.current(p)), [event])
}
