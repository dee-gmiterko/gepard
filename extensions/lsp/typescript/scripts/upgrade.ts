import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64',
];

interface Manifest {
  devDependencies: Record<string, string>;
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

async function latestVersion(name: string): Promise<string> {
  const url = `https://registry.npmjs.org/${name}/latest`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return ((await res.json()) as { version: string }).version;
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
const versions = await Promise.all(
  TARGETS.map((t) => latestVersion(`@typescript/typescript-${t}`)),
);
const version = versions[0];
if (versions.some((v) => v !== version)) {
  throw new Error(`platform packages disagree on the latest version: ${versions.join(', ')}`);
}
for (const target of TARGETS) {
  manifest.devDependencies[`@typescript/typescript-${target}`] = `^${version}`;
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
