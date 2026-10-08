import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS: Record<string, string> = {
  'linux-x64': 'phpantom_lsp-x86_64-unknown-linux-gnu.tar.gz',
  'linux-arm64': 'phpantom_lsp-aarch64-unknown-linux-gnu.tar.gz',
  'darwin-x64': 'phpantom_lsp-x86_64-apple-darwin.tar.gz',
  'darwin-arm64': 'phpantom_lsp-aarch64-apple-darwin.tar.gz',
  'win32-x64': 'phpantom_lsp-x86_64-pc-windows-msvc.zip',
  'win32-arm64': 'phpantom_lsp-aarch64-pc-windows-msvc.zip',
};

interface Manifest {
  gepard: { vendor: { version: string; assets: Record<string, { url: string; sha256: string }> } };
}

interface Release {
  tag_name: string;
  assets: { name: string; browser_download_url: string; digest: string | null }[];
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

const url = 'https://api.github.com/repos/PHPantom-dev/phpantom_lsp/releases/latest';
const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const res = await fetch(url, { headers });
if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
const release = (await res.json()) as Release;

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
for (const [target, name] of Object.entries(ASSETS)) {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new Error(`release ${release.tag_name} has no asset ${name}`);
  if (!asset.digest?.startsWith('sha256:')) throw new Error(`asset ${name} has no sha256 digest`);
  manifest.gepard.vendor.assets[target] = {
    url: asset.browser_download_url,
    sha256: asset.digest.slice('sha256:'.length),
  };
}
manifest.gepard.vendor.version = release.tag_name;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
