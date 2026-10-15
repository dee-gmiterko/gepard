import type { CatalogEntryStatus } from '@gepard/common';

export type CatalogAction = 'install' | 'upToDate' | 'builtin' | 'unsupported';

export function catalogAction(entry: CatalogEntryStatus): CatalogAction {
  if (entry.installedSource?.kind === 'builtin') return 'builtin';
  if (!entry.supported) return 'unsupported';
  if (entry.installedVersion === null) return 'install';
  return 'upToDate';
}
