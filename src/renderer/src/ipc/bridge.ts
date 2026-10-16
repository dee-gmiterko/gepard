import { SOCKET_PATH, type IpcBridge } from '@gepard/common';
import { currentHost } from './host';
import { createSocketBridge } from './socketBridge';

let socketBridge: IpcBridge | null = null;

export function socketUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${SOCKET_PATH}`;
}

export function ipcBridge(): IpcBridge {
  const host = currentHost();
  if (host.kind === 'desktop') return host.ipc;
  socketBridge ??= createSocketBridge(socketUrl(window.location));
  return socketBridge;
}
