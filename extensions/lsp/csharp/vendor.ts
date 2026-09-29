import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { packPayload, type PayloadEntry } from './payload.js';

const extensionDir = path.dirname(fileURLToPath(import.meta.url));
const vendorRoot = path.join(extensionDir, 'vendor');

interface Manifest {
  gepard: { vendor: { package: string; version: string } };
}

const manifest = JSON.parse(
  await readFile(path.join(extensionDir, 'package.json'), 'utf8'),
) as Manifest;
const { package: PACKAGE_ID, version: VERSION } = manifest.gepard.vendor;

async function collectFiles(
  dir: string,
  base = dir,
  skip: (rel: string) => boolean = () => false,
): Promise<PayloadEntry[]> {
  const entries: PayloadEntry[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const file = path.join(dir, name);
    const rel = path.relative(base, file);
    if (skip(rel)) continue;
    const info = await stat(file);
    if (info.isDirectory()) {
      entries.push(...(await collectFiles(file, base, skip)));
    } else {
      entries.push({ name: rel, mode: info.mode & 0o777, data: await readFile(file) });
    }
  }
  return entries;
}

async function vendorRoslyn(): Promise<void> {
  const url = `https://api.nuget.org/v3-flatcontainer/${PACKAGE_ID}/${VERSION}/${PACKAGE_ID}.${VERSION}.nupkg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download ${url}: ${res.status} ${res.statusText}`);
  const nupkg = Buffer.from(await res.arrayBuffer());

  const tmp = path.join(vendorRoot, `.tmp-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  const zipPath = path.join(tmp, 'package.nupkg');
  await writeFile(zipPath, nupkg);
  await promisify(execFile)('unzip', ['-q', '-o', zipPath, '-d', tmp]);

  const contentDir = path.join(tmp, 'content', 'LanguageServer', 'neutral');
  const libDir = path.join(tmp, 'lib', 'net9.0');
  const entries: PayloadEntry[] = [
    ...(await collectFiles(contentDir, contentDir, (rel) => rel.startsWith('BuildHost-net472'))),
    ...(await collectFiles(libDir)),
  ].map((e) => ({ ...e, name: path.join('lib', e.name) }));
  await mkdir(vendorRoot, { recursive: true });
  await writeFile(path.join(vendorRoot, 'payload.bin'), packPayload(entries));
  await writeFile(path.join(vendorRoot, 'version.txt'), `${VERSION}\n`);
  console.log(`vendored ${PACKAGE_ID}@${VERSION} (${entries.length} files)`);

  await rm(tmp, { recursive: true, force: true });
}

try {
  await vendorRoslyn();
} catch (e) {
  console.error(`failed to vendor the roslyn language server: ${(e as Error).message}`);
  process.exitCode = 1;
}
