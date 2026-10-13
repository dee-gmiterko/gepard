import {
  ExtensionCatalog,
  catalogAssetPlatform,
  isNewerVersion,
  type CatalogEntryStatus,
  type ExtensionInfo,
} from '@gepard/common';
import catalogJson from '../../../extensions/catalog.json';

export const extensionCatalog: ExtensionCatalog = ExtensionCatalog.parse(catalogJson);

export function catalogStatus(
  catalog: ExtensionCatalog,
  installed: readonly ExtensionInfo[],
  target: string,
): CatalogEntryStatus[] {
  return Object.entries(catalog.extensions).map(([name, entry]): CatalogEntryStatus => {
    const match =
      installed.find((ext) => ext.packageName === name && ext.source.kind === 'builtin') ??
      installed.find((ext) => ext.packageName === name);
    const installedVersion = match?.version ?? null;
    return {
      name,
      displayName: entry.displayName,
      kind: entry.kind,
      description: entry.description,
      repository: catalog.repository,
      path: entry.path,
      latestVersion: entry.version,
      sha: entry.sha,
      supported: catalogAssetPlatform(entry, target) !== null,
      installedVersion,
      installedSource: match?.source ?? null,
      updateAvailable:
        match?.source.kind === 'local' &&
        installedVersion !== null &&
        isNewerVersion(entry.version, installedVersion),
    };
  });
}
