import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ID = 'roslyn-language-server';
const RIDS: Record<string, string> = {
  'linux-x64': 'linux-x64',
  'linux-arm64': 'linux-arm64',
  'darwin-x64': 'osx-x64',
  'darwin-arm64': 'osx-arm64',
  'win32-x64': 'win-x64',
  'win32-arm64': 'win-arm64',
};

interface Manifest {
  gepard: {
    vendor: {
      package: string;
      version: string;
      assets: Record<string, { rid: string; sha512: string }>;
    };
  };
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const { versions } = await getJson<{ versions: string[] }>(
  `https://api.nuget.org/v3-flatcontainer/${PACKAGE_ID}.linux-x64/index.json`,
);
const version = versions.at(-1);
if (!version) throw new Error(`${PACKAGE_ID}.linux-x64 has no versions`);

const assets: Record<string, { rid: string; sha512: string }> = {};
for (const [target, rid] of Object.entries(RIDS)) {
  const id = `${PACKAGE_ID}.${rid}`;
  const { catalogEntry } = await getJson<{ catalogEntry: string }>(
    `https://api.nuget.org/v3/registration5-gz-semver2/${id}/${version}.json`,
  );
  const entry = await getJson<{ packageHash: string; packageHashAlgorithm: string }>(catalogEntry);
  if (entry.packageHashAlgorithm !== 'SHA512') {
    throw new Error(`${id} ${version} has a ${entry.packageHashAlgorithm} hash, expected SHA512`);
  }
  assets[target] = { rid, sha512: entry.packageHash };
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
manifest.gepard.vendor = { package: PACKAGE_ID, version, assets };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
