import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT_DIR, 'extensions/catalog.json');
const CACHE_DIR = path.join(ROOT_DIR, 'node_modules/.cache/gepard-extensions');
const OUT_DIR = path.join(ROOT_DIR, 'src/app/extensions-dist');

const BUNDLED_EXTENSIONS = [
  'gepard-theme-dark',
  'gepard-theme-dark-high-contrast',
  'gepard-theme-light',
  'gepard-theme-light-high-contrast',
  'gepard-locale-en',
];

const KIND_DIRS: Record<string, string> = {
  lsp: 'lsp',
  grammar: 'grammars',
  theme: 'themes',
  locale: 'locales',
};

interface CatalogEntry {
  kind: string;
  path: string;
  version: string;
  platforms?: string[];
}

interface Catalog {
  repository: string;
  extensions: Record<string, CatalogEntry>;
}

async function download(repository: string, name: string, version: string): Promise<string> {
  const file = `${name}-${version}.tgz`;
  const cached = path.join(CACHE_DIR, file);
  if (existsSync(cached)) return cached;
  const url = `https://github.com/${repository}/releases/download/${name}-v${version}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(`${cached}.part`, Buffer.from(await res.arrayBuffer()));
  renameSync(`${cached}.part`, cached);
  return cached;
}

async function main(): Promise<void> {
  const catalog = JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as Catalog;
  rmSync(OUT_DIR, { recursive: true, force: true });
  for (const name of BUNDLED_EXTENSIONS) {
    const entry = catalog.extensions[name];
    if (!entry) throw new Error(`${name} is not in the catalog; run \`yarn catalog:refresh\``);
    if (entry.platforms) throw new Error(`${name} has platform-specific builds; cannot bundle it`);
    const local = JSON.parse(
      readFileSync(path.join(ROOT_DIR, entry.path, 'package.json'), 'utf8'),
    ) as {
      version: string;
    };
    if (local.version !== entry.version) {
      throw new Error(
        `${name}: the catalog lists ${entry.version} but ${entry.path} is ${local.version}; run \`yarn catalog:refresh\``,
      );
    }
    const archive = await download(catalog.repository, name, entry.version);
    const kindDir = KIND_DIRS[entry.kind];
    if (!kindDir) throw new Error(`${name}: unknown extension kind ${JSON.stringify(entry.kind)}`);
    const dest = path.join(OUT_DIR, kindDir, name);
    mkdirSync(dest, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', dest, '--strip-components=1']);
    console.log(`${name}@${entry.version} -> ${path.relative(ROOT_DIR, dest)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
