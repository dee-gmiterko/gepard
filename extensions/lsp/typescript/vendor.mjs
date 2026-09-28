import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packPayload } from './payload.mjs';

const require = createRequire(import.meta.url);
const vendorRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vendor');

const targets = (process.env.GEPARD_VENDOR_TARGETS ?? `${process.platform}-${process.arch}`)
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

async function vendorTarget(target) {
  const pkgJsonPath = require.resolve(`@typescript/typescript-${target}/package.json`);
  const pkgDir = path.dirname(pkgJsonPath);
  const { version } = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
  const libDir = path.join(pkgDir, 'lib');
  const entries = [];
  for (const name of (await readdir(libDir)).sort()) {
    const file = path.join(libDir, name);
    const info = await stat(file);
    if (!info.isFile()) continue;
    entries.push({ name, mode: info.mode & 0o777, data: await readFile(file) });
  }
  const outDir = path.join(vendorRoot, target);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'payload.bin'), packPayload(entries));
  await writeFile(path.join(outDir, 'version.txt'), `${version}\n`);
  console.log(`vendored @typescript/typescript-${target}@${version} (${entries.length} files)`);
}

for (const target of targets) {
  try {
    await vendorTarget(target);
  } catch (e) {
    console.error(`failed to vendor TypeScript for ${target}: ${e.message}`);
    process.exitCode = 1;
  }
}
