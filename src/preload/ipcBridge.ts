// electron-vite externalizes `dependencies` by default, so only `electron` is
// safe to import here.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IpcBridge } from '@gepard/common/ipc/bridge';
import { channelNames, eventNames } from '@gepard/common/ipc/names';

const channelSet = new Set<string>(channelNames);
const eventSet = new Set<string>(eventNames);

const ipc: IpcBridge = {
  invoke(channel: string, input: unknown): Promise<unknown> {
    if (!channelSet.has(channel))
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`));
    return ipcRenderer.invoke(channel, input);
  },
  on(event: string, cb: (payload: unknown) => void): () => void {
    if (!eventSet.has(event)) throw new Error(`Unknown IPC event: ${event}`);
    const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
};

export function exposeIpcBridge(): void {
  contextBridge.exposeInMainWorld('ipc', ipc);
}
