import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import {
  buildCatalog,
  buildReleaseConfig,
  mergeReleaseManifest,
  render,
  type ExtensionManifest,
  type ExtensionPackage,
  type ReleaseConfig,
  type ReleaseManifest,
} from './helpers/catalog';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS_DIR = 'extensions';
const CATALOG_FILE = 'extensions/catalog.json';
const RELEASE_CONFIG_FILE = 'release-please-config.json';
const RELEASE_MANIFEST_FILE = '.release-please-manifest.json';

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(ROOT_DIR, file), 'utf8')) as T;
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
