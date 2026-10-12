import { nativeTheme } from 'electron';
import type { SystemPreference } from '@gepard/common';
import { portalContrast } from './portalTheme';

export function systemPreference(): SystemPreference {
  return {
    mode: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    // nativeTheme only knows the Windows high contrast setting; Linux comes from the portal.
    contrast:
      nativeTheme.shouldUseHighContrastColors || portalContrast() === 'high' ? 'high' : 'normal',
  };
}
