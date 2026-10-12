import { nativeTheme } from 'electron';
import type { SystemPreference } from '@gepard/common';
import { portalContrast, portalReducedMotion } from './portalTheme';

export function systemPreference(): SystemPreference {
  return {
    mode: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    contrast:
      nativeTheme.shouldUseHighContrastColors || portalContrast() === 'high' ? 'high' : 'normal',
    reducedMotion: portalReducedMotion(),
  };
}
