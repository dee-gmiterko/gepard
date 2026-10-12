import {
  AppError,
  ExtensionCatalog,
  catalogAssetPlatform,
  errorMessage,
  isNewerVersion,
  type CatalogEntryStatus,
  type CatalogSource,
  type ExtensionInfo,
} from '@gepard/common';
import builtinCatalogJson from '../../../extensions/catalog.json';

export const CATALOG_URL =
  'https://raw.githubusercontent.com/dee-gmiterko/gepard/main/extensions/catalog.json';

const FETCH_TIMEOUT_MS = 10_000;

export type FetchText = (url: string) => Promise<string>;

export const builtinCatalog: ExtensionCatalog = ExtensionCatalog.parse(builtinCatalogJson);

export async function fetchTextWithTimeout(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new AppError('CATALOG_UNAVAILABLE', `${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

export function parseCatalog(text: string): ExtensionCatalog {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new AppError('CATALOG_INVALID', `catalog is not valid JSON: ${errorMessage(e)}`);
  }
  const parsed = ExtensionCatalog.safeParse(json);
  if (!parsed.success) {
    throw new AppError('CATALOG_INVALID', `catalog has an unexpected shape`, parsed.error.issues);
  }
  return parsed.data;
}

export interface LoadedCatalog {
  source: CatalogSource;
  catalog: ExtensionCatalog;
  error?: string;
}

export async function loadCatalog(
  fetchText: FetchText = fetchTextWithTimeout,
  url: string = CATALOG_URL,
  fallback: ExtensionCatalog = builtinCatalog,
): Promise<LoadedCatalog> {
  try {
    return { source: 'remote', catalog: parseCatalog(await fetchText(url)) };
  } catch (e) {
    return { source: 'builtin', catalog: fallback, error: errorMessage(e) };
  }
}

export function catalogStatus(
  catalog: ExtensionCatalog,
  installed: readonly ExtensionInfo[],
  target: string,
): CatalogEntryStatus[] {
  return Object.entries(catalog.extensions).map(([name, entry]): CatalogEntryStatus => {
    const match =
      installed.find((ext) => ext.packageName === name && ext.source === 'builtin') ??
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
      supported: catalogAssetPlatform(entry, target) !== null,
      installedVersion,
      installedSource: match?.source ?? null,
      updateAvailable:
        match?.source === 'external' &&
        installedVersion !== null &&
        isNewerVersion(entry.version, installedVersion),
    };
  });
}
