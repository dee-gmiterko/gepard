import { nativeTheme } from 'electron';
import type { SystemThemePreference } from '@gepard/common';
import { portalPrefersHighContrast } from './portalTheme';

export function systemThemePreference(): SystemThemePreference {
  return {
    dark: nativeTheme.shouldUseDarkColors,
    // nativeTheme only knows the Windows high contrast setting; Linux comes from the portal.
    highContrast: nativeTheme.shouldUseHighContrastColors || portalPrefersHighContrast(),
  };
}
