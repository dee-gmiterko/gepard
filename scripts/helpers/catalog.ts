export interface ExtensionManifest {
  name: string;
  version: string;
  description?: string;
  gepard: { type: string; displayName?: string; platforms?: string[] };
}

export interface ExtensionPackage {
  path: string;
  manifest: ExtensionManifest;
}

export interface CatalogEntry {
  name: string;
  repository: string;
  path: string;
  displayName: string;
  kind: string;
  description: string;
  platforms?: string[];
  sha: string;
}

export type Catalog = CatalogEntry[];

export type ReleaseConfig = Record<string, unknown> & {
  packages: Record<string, Record<string, unknown>>;
};

export function buildCatalog(
  packages: ExtensionPackage[],
  repository: string,
  shaOf: (dir: string) => string,
): Catalog {
  return packages.map(({ path: dir, manifest }) => ({
    name: manifest.name,
    repository,
    path: dir,
    displayName: manifest.gepard.displayName ?? manifest.name,
    kind: manifest.gepard.type,
    description: manifest.description ?? '',
    ...(manifest.gepard.platforms?.length ? { platforms: manifest.gepard.platforms } : {}),
    sha: shaOf(dir),
  }));
}

export function buildReleaseConfig(
  existing: ReleaseConfig,
  packages: ExtensionPackage[],
): ReleaseConfig {
  const kept = Object.entries(existing.packages).filter(([dir]) => !dir.startsWith('extensions/'));
  const generated = packages.map(({ path: dir, manifest }): [string, Record<string, unknown>] => [
    dir,
    {
      component: manifest.name,
      'include-component-in-tag': true,
    },
  ]);
  return { ...existing, packages: Object.fromEntries([...kept, ...generated]) };
}
