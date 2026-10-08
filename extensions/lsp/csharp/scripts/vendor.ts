import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { collectFiles, packPayload, type PayloadEntry } from '@gepard/common';

const extensionDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = path.join(extensionDir, 'vendor');

interface Manifest {
  gepard: {
    vendor: {
      package: string;
      version: string;
      assets: Record<string, { rid: string; sha512: string }>;
    };
  };
}

const manifest = JSON.parse(
  await readFile(path.join(extensionDir, 'package.json'), 'utf8'),
) as Manifest;
const { package: PACKAGE_ID, version: VERSION, assets: ASSETS } = manifest.gepard.vendor;

const targets = (process.env.GEPARD_VENDOR_TARGETS ?? `${process.platform}-${process.arch}`)
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

async function vendorTarget(target: string): Promise<void> {
  const asset = ASSETS[target];
  if (!asset) throw new Error(`no roslyn language server package for ${target}`);
  const id = `${PACKAGE_ID}.${asset.rid}`;
  const url = `https://api.nuget.org/v3-flatcontainer/${id}/${VERSION}/${id}.${VERSION}.nupkg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download ${url}: ${res.status} ${res.statusText}`);
  const nupkg = Buffer.from(await res.arrayBuffer());
  const actual = createHash('sha512').update(nupkg).digest('base64');
  if (actual !== asset.sha512) {
    throw new Error(`checksum mismatch for ${url}: expected ${asset.sha512}, got ${actual}`);
  }

  const tmp = path.join(vendorRoot, `.tmp-${target}-${process.pid}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  try {
    const zipPath = path.join(tmp, 'package.nupkg');
    await writeFile(zipPath, nupkg);
    await promisify(execFile)('unzip', ['-q', '-o', zipPath, '-d', tmp]);

    const toolsDir = path.join(tmp, 'tools');
    const [framework] = await readdir(toolsDir);
    if (!framework) throw new Error(`${id} ${VERSION} has no tools directory`);
    const contentDir = path.join(toolsDir, framework, asset.rid);
    const entries: PayloadEntry[] = (
      await collectFiles(contentDir, (rel) => rel.startsWith('BuildHost-net472'))
    ).map((e) => ({ ...e, name: path.join('lib', e.name) }));

    const outDir = path.join(vendorRoot, target);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'payload.bin'), packPayload(entries));
    await writeFile(path.join(outDir, 'version.txt'), `${VERSION}\n`);
    console.log(`vendored ${id}@${VERSION} (${entries.length} files)`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

for (const target of targets) {
  try {
    await vendorTarget(target);
  } catch (e) {
    console.error(
      `failed to vendor the roslyn language server for ${target}: ${(e as Error).message}`,
    );
    process.exitCode = 1;
  }
}
