import { nativeTheme } from 'electron';
import type { SystemPreference } from '@gepard/common';
import type { PortalTheme } from './portalTheme';
import type { SystemPreferenceSource } from '@gepard/main/services/systemPreference';

export class ElectronSystemPreferenceSource implements SystemPreferenceSource {
  constructor(private readonly portal: PortalTheme) {}

  read(): SystemPreference {
    return {
      mode: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      contrast:
        nativeTheme.shouldUseHighContrastColors || this.portal.contrast() === 'high'
          ? 'high'
          : 'normal',
      reducedMotion: this.portal.reducedMotion(),
    };
  }
}
