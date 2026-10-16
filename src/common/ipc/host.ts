import { z } from 'zod';

export const HostKind = z.enum(['desktop', 'server']);
export type HostKind = z.infer<typeof HostKind>;

export interface HostCapabilities {
  folderPicker: boolean;
  detachedWindows: boolean;
  contextMenu: boolean;
}

export const HOST_CAPABILITIES: Record<HostKind, HostCapabilities> = {
  desktop: { folderPicker: true, detachedWindows: true, contextMenu: true },
  server: { folderPicker: false, detachedWindows: false, contextMenu: false },
};

// The server marks the page it serves with `<meta name="gepard-host" content="server">`;
// the desktop host exposes `window.gepard` from its preload script instead.
export const HOST_META_NAME = 'gepard-host';
