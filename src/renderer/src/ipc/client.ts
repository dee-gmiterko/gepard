import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  type ChannelName,
  type ChannelOutput,
  type EventName,
  type EventPayload,
  type InvokeArgs,
  fromIpcErrorShape,
} from '@gepard/common';
import { ipcBridge } from './bridge';

export async function invoke<C extends ChannelName>(
  channel: C,
  ...args: InvokeArgs<C>
): Promise<ChannelOutput<C>> {
  const res = await ipcBridge().invoke(channel, args[0]);
  if (!res.ok) throw fromIpcErrorShape(res.error, channel);
  return res.value;
}

export function subscribe<E extends EventName>(
  event: E,
  cb: (payload: EventPayload<E>) => void,
): () => void {
  return ipcBridge().on(event, cb);
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
