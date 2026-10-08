import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Manifest {
  devDependencies: Record<string, string>;
}

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

const url = 'https://registry.npmjs.org/pyright/latest';
const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
const { version } = (await res.json()) as { version: string };

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
manifest.devDependencies.pyright = `^${version}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
