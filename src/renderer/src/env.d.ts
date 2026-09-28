/// <reference types="vite/client" />
import type { IpcBridge } from '@gepard/common/ipc/bridge';

declare global {
  interface Window {
    ipc: IpcBridge;
  }
}
