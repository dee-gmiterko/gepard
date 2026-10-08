import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const GITHUB_ASSETS: Record<string, string> = {
  'linux-x64': 'linux',
  'darwin-x64': 'mac',
  'darwin-arm64': 'mac',
  'win32-x64': 'windows',
};
const PYPI_WHEELS: Record<string, string> = {
  'linux-arm64': '-manylinux_2_27_aarch64.manylinux_2_28_aarch64.whl',
  'win32-arm64': '-win_arm64.whl',
};

interface Asset {
  url: string;
  sha256: string;
  strip: string;
}

interface Manifest {
  gepard: { vendor: { version: string; assets: Record<string, Asset> } };
}

interface Release {
  tag_name: string;
  assets: { name: string; browser_download_url: string; digest: string | null }[];
}

interface PypiProject {
  urls: { filename: string; url: string; digests: { sha256: string } }[];
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const githubHeaders: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const [release, pypi] = await Promise.all([
  getJson<Release>('https://api.github.com/repos/clangd/clangd/releases/latest', githubHeaders),
  getJson<PypiProject>('https://pypi.org/pypi/clangd/json'),
]);
const version = release.tag_name;

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
const { assets } = manifest.gepard.vendor;

for (const [target, os] of Object.entries(GITHUB_ASSETS)) {
  const name = `clangd-${os}-${version}.zip`;
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new Error(`release ${version} has no asset ${name}`);
  if (!asset.digest?.startsWith('sha256:')) throw new Error(`asset ${name} has no sha256 digest`);
  assets[target] = {
    url: asset.browser_download_url,
    sha256: asset.digest.slice('sha256:'.length),
    strip: `clangd_${version}/`,
  };
}

for (const [target, suffix] of Object.entries(PYPI_WHEELS)) {
  const wheel = pypi.urls.find((u) => u.filename.endsWith(suffix));
  if (!wheel) throw new Error(`latest clangd on PyPI has no wheel ending in ${suffix}`);
  assets[target] = { url: wheel.url, sha256: wheel.digests.sha256, strip: 'clangd/data/' };
}

manifest.gepard.vendor.version = version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
