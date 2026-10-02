import { RepoPath } from '@gepard/common';

export function isValidRepoPath(path: string): boolean {
  return RepoPath.safeParse(path).success;
}

export function foldersOf(paths: readonly string[]): string[] {
  const set = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    parts.pop();
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      set.add(acc);
    }
  }
  return [...set].sort();
}

export function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}
