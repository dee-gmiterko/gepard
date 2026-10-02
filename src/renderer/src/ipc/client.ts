import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  type ChannelName,
  type ChannelOutput,
  type EventName,
  type EventPayload,
  type InvokeArgs,
  IpcError,
} from '@gepard/common';

export function isCancelledError(error: unknown): boolean {
  return error instanceof IpcError && error.code === 'CANCELLED';
}

export function isStaleShaError(error: unknown): boolean {
  return error instanceof IpcError && error.code === 'STALE_SHA';
}

export async function invoke<C extends ChannelName>(
  channel: C,
  ...args: InvokeArgs<C>
): Promise<ChannelOutput<C>> {
  const res = await window.ipc.invoke(channel, args[0]);
  if (!res.ok) throw new IpcError(res.error, channel);
  return res.value;
}

export function subscribe<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void,
): () => void {
  return window.ipc.on(event, cb);
}

export function useIpcEvent<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void,
): void {
  const ref = useRef(cb);
  useLayoutEffect(() => {
    ref.current = cb;
  });
  useEffect(() => subscribe(event, (p) => ref.current(p)), [event]);
}
