import { HOST_CAPABILITIES, type HostCapabilities } from '@gepard/common';

export function hostCapabilities(): HostCapabilities {
  return HOST_CAPABILITIES[window.gepard.host];
}
