import type { IpcBridge } from './ipcBridge'

declare global {
  interface Window {
    ipc: IpcBridge
  }
}
