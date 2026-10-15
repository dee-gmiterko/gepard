import type { CatalogEntry, ExtensionCatalog } from '../extensions/catalog';
import { normalizeRepoPath } from './path';
import { repositorySlug, type RepositoryInput } from './repoUrl';

export const PLATFORM_ANY = 'any';

export function catalogAssetPlatform(entry: CatalogEntry, target: string): string | null {
  if (!entry.platforms) return PLATFORM_ANY;
  return entry.platforms.includes(target) ? target : null;
}

export function findCatalogEntry(
  catalog: ExtensionCatalog,
  repo: RepositoryInput,
  dir: string | null,
): CatalogEntry | null {
  if (dir === null) return null;
  return (
    catalog.find(
      (entry) => entry.repository === repositorySlug(repo) && normalizeRepoPath(entry.path) === dir,
    ) ?? null
  );
}
