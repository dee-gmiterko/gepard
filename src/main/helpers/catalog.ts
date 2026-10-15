import {
  catalogAssetPlatform,
  type CatalogEntryStatus,
  type ExtensionCatalog,
  type ExtensionInfo,
} from '@gepard/common';

export function catalogStatus(
  catalog: ExtensionCatalog,
  installed: readonly ExtensionInfo[],
  target: string,
): CatalogEntryStatus[] {
  return catalog.extensions.map((entry): CatalogEntryStatus => {
    const match =
      installed.find((ext) => ext.packageName === entry.name && ext.source.kind === 'builtin') ??
      installed.find((ext) => ext.packageName === entry.name);
    return {
      name: entry.name,
      displayName: entry.displayName,
      kind: entry.kind,
      description: entry.description,
      repository: entry.repository,
      path: entry.path,
      sha: entry.sha,
      supported: catalogAssetPlatform(entry, target) !== null,
      installedVersion: match?.version ?? null,
      installedSource: match?.source ?? null,
    };
  });
}
