import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { AppError } from '@gepard/common';

export function resolveInRepo(repoRoot: string, repoPath: string): string {
  const root = resolve(repoRoot);
  const full = resolve(root, repoPath);
  const rel = relative(root, full);
  const escapes = rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (repoPath === '' || isAbsolute(repoPath) || escapes) {
    throw new AppError(
      'INVALID_PATH',
      `Path ${JSON.stringify(repoPath)} is outside the repository`,
    );
  }
  return join(root, rel);
}

export function assertInRepo(repoRoot: string, repoPath: string): void {
  resolveInRepo(repoRoot, repoPath);
}
