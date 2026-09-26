// Report 04 §2.5, full file. Allow-list bridge, no logic: with sandbox:
// true, electron-vite externalizes `dependencies` by default, so any import
// beyond `electron` and this zod-free names list would bundle `require(...)`
// calls the sandboxed preload cannot satisfy (report 04 §2.2).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { channelNames, eventNames } from '@shared/ipc/names'

const channelSet = new Set<string>(channelNames)
const eventSet = new Set<string>(eventNames)

const ipc = {
  invoke(channel: string, input: unknown): Promise<unknown> {
    if (!channelSet.has(channel))
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`))
    return ipcRenderer.invoke(channel, input)
  },
  on(event: string, cb: (payload: unknown) => void): () => void {
    if (!eventSet.has(event)) throw new Error(`Unknown IPC event: ${event}`)
    const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  }
}
export type IpcBridge = typeof ipc
contextBridge.exposeInMainWorld('ipc', ipc)
