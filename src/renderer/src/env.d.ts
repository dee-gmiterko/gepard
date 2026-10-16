/// <reference types="vite/client" />
import type { IpcBridge } from '@gepard/common';

declare global {
  interface Window {
    gepard: { host: 'desktop' | 'browser'; ipc: IpcBridge };
  }
}
