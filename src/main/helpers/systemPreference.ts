import type { SystemPreference } from '@gepard/common';

let source: () => SystemPreference = () => ({
  mode: 'light',
  contrast: 'normal',
  reducedMotion: false,
});

export function setSystemPreferenceSource(next: () => SystemPreference): void {
  source = next;
}

export function systemPreference(): SystemPreference {
  return source();
}
