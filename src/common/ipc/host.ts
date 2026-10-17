export interface HostCapabilities {
  folderPicker: boolean;
  detachedWindows: boolean;
}

export const HOST_CAPABILITIES: Record<'desktop' | 'browser', HostCapabilities> = {
  desktop: { folderPicker: true, detachedWindows: true },
  browser: { folderPicker: false, detachedWindows: false },
};
