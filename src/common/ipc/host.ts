export interface HostCapabilities {
  folderPicker: boolean;
  detachedWindows: boolean;
  contextMenu: boolean;
}

export const HOST_CAPABILITIES: Record<'desktop' | 'browser', HostCapabilities> = {
  desktop: { folderPicker: true, detachedWindows: true, contextMenu: true },
  browser: { folderPicker: false, detachedWindows: false, contextMenu: false },
};
