import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { AppError, packageManifestSchema, type PackageManifest } from '@gepard/common';

export async function readManifest(pkgDir: string): Promise<PackageManifest> {
  const raw = await readFile(path.join(pkgDir, 'package.json'), 'utf8');
  const parsed = packageManifestSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error('package.json is not an object');
  return parsed.data;
}

export async function findPackageRoot(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'package.json')) return dir;
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) {
    const nested = path.join(dir, dirs[0].name);
    const inner = await readdir(nested, { withFileTypes: true });
    if (inner.some((e) => e.isFile() && e.name === 'package.json')) return nested;
  }
  throw new AppError('EXTENSION_INVALID_ARCHIVE', 'archive does not contain a package.json');
}
