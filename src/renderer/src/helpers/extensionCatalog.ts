import type { CatalogEntryStatus } from '@gepard/common';

export type CatalogAction = 'install' | 'update' | 'upToDate' | 'builtin' | 'unsupported';

export function catalogAction(entry: CatalogEntryStatus): CatalogAction {
  if (entry.installedSource === 'builtin') return 'builtin';
  if (!entry.supported) return 'unsupported';
  if (entry.installedVersion === null) return 'install';
  return entry.updateAvailable ? 'update' : 'upToDate';
}

export function isRepositoryInputValid(text: string): boolean {
  const trimmed = text
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed);
}
