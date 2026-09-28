import { useEffect, useLayoutEffect, useRef } from 'react';
import type {
  ChannelName,
  ChannelOutput,
  EventName,
  EventPayload,
  Envelope,
  InvokeArgs,
  IpcErrorShape,
} from '@gepard/common/ipc/contract';

export class IpcError extends Error {
  code: string;
  details?: unknown;
  channel?: string;
  constructor(shape: IpcErrorShape, channel?: string) {
    super(shape.message);
    this.name = 'IpcError';
    this.code = shape.code;
    this.details = shape.details;
    this.channel = channel;
  }
}

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
  const res = (await window.ipc.invoke(channel, args[0])) as Envelope<ChannelOutput<C>>;
  if (!res.ok) throw new IpcError(res.error, channel);
  return res.value;
}

export function subscribe<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void,
): () => void {
  return window.ipc.on(event, (raw) => cb(raw as EventPayload<E>));
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
