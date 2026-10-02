// electron-vite externalizes `dependencies` by default, so only `electron` is
// safe to import here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  type ChannelName,
  type EventName,
  type EventPayload,
  type IpcBridge,
  channelNames,
  eventNames,
} from '@gepard/common';

const channelSet = new Set<string>(channelNames);
const eventSet = new Set<string>(eventNames);

const ipc: IpcBridge = {
  invoke(channel: ChannelName, input: unknown) {
    if (!channelSet.has(channel))
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`));
    return ipcRenderer.invoke(channel, input);
  },
  on<E extends EventName>(event: E, cb: (payload: EventPayload<E>) => void): () => void {
    if (!eventSet.has(event)) throw new Error(`Unknown IPC event: ${event}`);
    const listener = (_e: IpcRendererEvent, payload: EventPayload<E>): void => cb(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
};

export function exposeIpcBridge(): void {
  contextBridge.exposeInMainWorld('ipc', ipc);
}
