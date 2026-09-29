import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { packPayload, type PayloadEntry } from './payload.js';

const extensionDir = path.dirname(fileURLToPath(import.meta.url));
const vendorRoot = path.join(extensionDir, 'vendor');

interface Manifest {
  gepard: { vendor: { url: string; version: string } };
}

const manifest = JSON.parse(
  await readFile(path.join(extensionDir, 'package.json'), 'utf8'),
) as Manifest;
const { url: TARBALL_URL, version: VERSION } = manifest.gepard.vendor;

async function collectFiles(dir: string, base = dir): Promise<PayloadEntry[]> {
  const entries: PayloadEntry[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const file = path.join(dir, name);
    const info = await stat(file);
    if (info.isDirectory()) {
      entries.push(...(await collectFiles(file, base)));
    } else {
      entries.push({
        name: path.relative(base, file),
        mode: info.mode & 0o777,
        data: await readFile(file),
      });
    }
  }
  return entries;
}

async function vendorJdtls(): Promise<void> {
  const res = await fetch(TARBALL_URL);
  if (!res.ok)
    throw new Error(`failed to download ${TARBALL_URL}: ${res.status} ${res.statusText}`);
  const tarball = Buffer.from(await res.arrayBuffer());

  const tmp = path.join(vendorRoot, `.tmp-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  const tarPath = path.join(tmp, 'jdtls.tar.gz');
  await writeFile(tarPath, tarball);
  await promisify(execFile)('tar', ['xzf', tarPath, '-C', tmp]);
  await rm(tarPath, { force: true });

  const pluginsDir = path.join(tmp, 'plugins');
  const entries: PayloadEntry[] = [
    ...(await collectFiles(pluginsDir)).map((e) => ({ ...e, name: path.join('plugins', e.name) })),
    ...(await collectFiles(path.join(tmp, 'features'))).map((e) => ({
      ...e,
      name: path.join('features', e.name),
    })),
    ...(await collectFiles(path.join(tmp, 'config_linux'))).map((e) => ({
      ...e,
      name: path.join('config_linux', e.name),
    })),
    ...(await collectFiles(path.join(tmp, 'config_mac'))).map((e) => ({
      ...e,
      name: path.join('config_mac', e.name),
    })),
    ...(await collectFiles(path.join(tmp, 'config_win'))).map((e) => ({
      ...e,
      name: path.join('config_win', e.name),
    })),
  ];
  await mkdir(vendorRoot, { recursive: true });
  await writeFile(path.join(vendorRoot, 'payload.bin'), packPayload(entries));
  await writeFile(path.join(vendorRoot, 'version.txt'), `${VERSION}\n`);
  console.log(`vendored eclipse.jdt.ls@${VERSION} (${entries.length} files)`);

  await rm(tmp, { recursive: true, force: true });
}

try {
  await vendorJdtls();
} catch (e) {
  console.error(`failed to vendor eclipse.jdt.ls: ${(e as Error).message}`);
  process.exitCode = 1;
}
