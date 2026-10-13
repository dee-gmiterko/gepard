import type { CatalogEntryStatus } from '@gepard/common';

export type CatalogAction = 'install' | 'update' | 'upToDate' | 'builtin' | 'unsupported';

export function catalogAction(entry: CatalogEntryStatus): CatalogAction {
  if (entry.installedSource?.kind === 'builtin') return 'builtin';
  if (!entry.supported) return 'unsupported';
  if (entry.installedVersion === null) return 'install';
  return entry.updateAvailable ? 'update' : 'upToDate';
}
