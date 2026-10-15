import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { AppError, type ExtensionInfo } from '@gepard/common';

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

// Every kind scans the shared extensions folder, so a broken package is reported once per kind.
export function dedupeBroken(list: readonly ExtensionInfo[]): ExtensionInfo[] {
  const seen = new Set<string>();
  return list.filter((ext) => {
    if (ext.error === undefined) return true;
    if (seen.has(ext.id)) return false;
    seen.add(ext.id);
    return true;
  });
}
