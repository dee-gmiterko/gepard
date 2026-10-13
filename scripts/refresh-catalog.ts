import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS_DIR = 'extensions';
const CATALOG_FILE = 'extensions/catalog.json';
const RELEASE_CONFIG_FILE = 'release-please-config.json';
const RELEASE_MANIFEST_FILE = '.release-please-manifest.json';

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
  displayName: string;
  kind: string;
  description: string;
  path: string;
  version: string;
  platforms?: string[];
  sha: string;
}

export interface Catalog {
  schemaVersion: 1;
  repository: string;
  extensions: Record<string, CatalogEntry>;
}

export type ReleaseConfig = Record<string, unknown> & {
  packages: Record<string, Record<string, unknown>>;
};

export type ReleaseManifest = Record<string, string>;

export function buildCatalog(
  packages: ExtensionPackage[],
  repository: string,
  shaOf: (dir: string) => string,
): Catalog {
  const extensions: Record<string, CatalogEntry> = {};
  for (const { path: dir, manifest } of packages) {
    extensions[manifest.name] = {
      displayName: manifest.gepard.displayName ?? manifest.name,
      kind: manifest.gepard.type,
      description: manifest.description ?? '',
      path: dir,
      version: manifest.version,
      ...(manifest.gepard.platforms?.length ? { platforms: manifest.gepard.platforms } : {}),
      sha: shaOf(dir),
    };
  }
  return { schemaVersion: 1, repository, extensions };
}

export function buildReleaseConfig(
  existing: ReleaseConfig,
  packages: ExtensionPackage[],
): ReleaseConfig {
  const kept = Object.entries(existing.packages).filter(
    ([dir]) => !dir.startsWith(`${EXTENSIONS_DIR}/`),
  );
  const generated = packages.map(({ path: dir, manifest }): [string, Record<string, unknown>] => [
    dir,
    {
      component: manifest.name,
      'include-component-in-tag': true,
      'extra-files': [
        {
          type: 'json',
          path: `/${CATALOG_FILE}`,
          jsonpath: `$.extensions['${manifest.name}'].version`,
        },
      ],
    },
  ]);
  return { ...existing, packages: Object.fromEntries([...kept, ...generated]) };
}

export function mergeReleaseManifest(
  existing: ReleaseManifest,
  packages: ExtensionPackage[],
): ReleaseManifest {
  const added = packages
    .filter(({ path: dir }) => !(dir in existing))
    .map(({ path: dir, manifest }): [string, string] => [dir, manifest.version]);
  return { ...existing, ...Object.fromEntries(added) };
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(ROOT_DIR, file), 'utf8')) as T;
}

function render(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function listExtensionPackages(): ExtensionPackage[] {
  const root = path.join(ROOT_DIR, EXTENSIONS_DIR);
  const packages: ExtensionPackage[] = [];
  for (const kind of readdirSync(root, { withFileTypes: true })) {
    if (!kind.isDirectory() || kind.name.startsWith('.')) continue;
    for (const ext of readdirSync(path.join(root, kind.name), { withFileTypes: true })) {
      if (!ext.isDirectory() || ext.name.startsWith('.')) continue;
      const dir = path.posix.join(EXTENSIONS_DIR, kind.name, ext.name);
      let manifest: ExtensionManifest;
      try {
        manifest = readJson<ExtensionManifest>(path.posix.join(dir, 'package.json'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      if (!manifest.gepard?.type) throw new Error(`${dir}/package.json has no "gepard.type"`);
      packages.push({ path: dir, manifest });
    }
  }
  return packages.sort((a, b) => (a.path < b.path ? -1 : 1));
}

function repositorySlug(): string {
  const { repository } = readJson<{ repository?: { url?: string } }>('package.json');
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repository?.url ?? '');
  if (!match) throw new Error('package.json "repository.url" is not a GitHub repository');
  return `${match[1]}/${match[2]}`;
}

// The tree id of the extension directory as git would commit it from the working tree.
function treeSha(dir: string): string {
  const tmp = mkdtempSync(path.join(tmpdir(), 'gepard-catalog-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'index') };
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: ROOT_DIR, env, encoding: 'utf8' }).trim();
    git('add', '-A', '--', dir);
    return git('write-tree', `--prefix=${dir}/`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main({ check }: { check: boolean }): void {
  const packages = listExtensionPackages();
  const outputs = [
    { file: CATALOG_FILE, content: render(buildCatalog(packages, repositorySlug(), treeSha)) },
    {
      file: RELEASE_CONFIG_FILE,
      content: render(buildReleaseConfig(readJson<ReleaseConfig>(RELEASE_CONFIG_FILE), packages)),
    },
    {
      file: RELEASE_MANIFEST_FILE,
      content: render(
        mergeReleaseManifest(readJson<ReleaseManifest>(RELEASE_MANIFEST_FILE), packages),
      ),
    },
  ];

  if (check) {
    const outdated = outputs.filter(
      ({ file, content }) => readFileSync(path.join(ROOT_DIR, file), 'utf8') !== content,
    );
    if (outdated.length > 0) {
      console.error(
        `Extension catalog files are out of date: ${outdated.map((o) => o.file).join(', ')}. ` +
          'Run `yarn catalog:refresh` and commit the result.',
      );
      process.exitCode = 1;
      return;
    }
    console.log('Extension catalog files are up to date.');
    return;
  }

  for (const { file, content } of outputs) writeFileSync(path.join(ROOT_DIR, file), content);
  console.log(`Refreshed ${outputs.length} file(s) from ${packages.length} extension(s).`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = yargs(hideBin(process.argv))
    .option('check', {
      type: 'boolean',
      default: false,
      description: 'Verify the catalog and release-please files are up to date without writing',
    })
    .strict()
    .parseSync();

  main({ check: argv.check });
}
