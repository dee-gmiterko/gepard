import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFiles, packPayload, type PayloadEntry } from '@gepard/common-lsp';

const require = createRequire(import.meta.url);
const vendorRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor');

async function vendorPyright(): Promise<void> {
  const pkgJsonPath = require.resolve('pyright/package.json');
  const pkgDir = path.dirname(pkgJsonPath);
  const { version } = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as { version: string };
  const entries: PayloadEntry[] = [
    ...(await collectFiles(path.join(pkgDir, 'dist'))).map((e) => ({
      ...e,
      name: path.join('dist', e.name),
    })),
    {
      name: 'LICENSE.txt',
      mode: (await stat(path.join(pkgDir, 'LICENSE.txt'))).mode & 0o777,
      data: await readFile(path.join(pkgDir, 'LICENSE.txt')),
    },
  ];
  await mkdir(vendorRoot, { recursive: true });
  await writeFile(path.join(vendorRoot, 'payload.bin'), packPayload(entries));
  await writeFile(path.join(vendorRoot, 'version.txt'), `${version}\n`);
  console.log(`vendored pyright@${version} (${entries.length} files)`);
}

try {
  await vendorPyright();
} catch (e) {
  console.error(`failed to vendor pyright: ${(e as Error).message}`);
  process.exitCode = 1;
}
