import { SOCKET_PATH, type IpcBridge } from '@gepard/common';
import { createSocketBridge } from './socketBridge';

let socketBridge: IpcBridge | null = null;

export function socketUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${SOCKET_PATH}`;
}

export function ipcBridge(): IpcBridge {
  if (window.ipc !== undefined) return window.ipc;
  socketBridge ??= createSocketBridge(socketUrl(window.location));
  return socketBridge;
}
