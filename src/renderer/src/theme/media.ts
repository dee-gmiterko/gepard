import type { SystemPreference, ThemeContrast } from '@gepard/common';

export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const HIGH_CONTRAST_QUERIES = ['(prefers-contrast: more)', '(forced-colors: active)'];

function mediaMatches(query: string): boolean {
  return window.matchMedia(query).matches;
}

export function mediaContrast(): ThemeContrast {
  return HIGH_CONTRAST_QUERIES.some(mediaMatches) ? 'high' : 'normal';
}

export function mediaSystemPreference(): SystemPreference {
  return {
    mode: mediaMatches(DARK_QUERY) ? 'dark' : 'light',
    contrast: mediaContrast(),
    reducedMotion: mediaMatches(REDUCED_MOTION_QUERY),
  };
}

export function watchMedia(queries: string[], onChange: () => void): () => void {
  const lists = queries.map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}
