import {
  HOST_CAPABILITIES,
  HOST_META_NAME,
  type HostCapabilities,
  type IpcBridge,
} from '@gepard/common';

export type Host = { kind: 'desktop'; ipc: IpcBridge } | { kind: 'server' };

export class UnknownHostError extends Error {
  constructor() {
    super('The page was not served by a Gepard host.');
    this.name = 'UnknownHostError';
  }
}

export function detectHost(
  win: { gepard?: { host: 'desktop'; ipc: IpcBridge } },
  doc: () => {
    querySelector(selector: string): { getAttribute(name: string): string | null } | null;
  },
): Host {
  if (win.gepard !== undefined) return { kind: 'desktop', ipc: win.gepard.ipc };
  const marker = doc().querySelector(`meta[name="${HOST_META_NAME}"]`)?.getAttribute('content');
  if (marker === 'server') return { kind: 'server' };
  throw new UnknownHostError();
}

export function currentHost(): Host {
  return detectHost(window, () => document);
}

export function hostCapabilities(): HostCapabilities {
  return HOST_CAPABILITIES[currentHost().kind];
}
