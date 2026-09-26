import type { IpcBridge } from './index'

declare global {
  interface Window {
    ipc: IpcBridge
  }
}
