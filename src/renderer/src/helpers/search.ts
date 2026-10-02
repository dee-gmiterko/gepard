import type { GroupedResult } from '@gepard/common';

export type FileMatches = GroupedResult['files'][number];
export type MatchItem = FileMatches['matches'][number];

export type SearchRow =
  | { kind: 'folder'; key: string; path: string; name: string; depth: number }
  | { kind: 'file'; key: string; path: string; name: string; depth: number; file: FileMatches }
  | { kind: 'match'; key: string; depth: number; filePath: string; match: MatchItem };

export function buildSearchRows(
  files: readonly FileMatches[],
  mode: 'tree' | 'flat',
  isExpanded: (path: string) => boolean,
): SearchRow[] {
  const rows: SearchRow[] = [];
  const openFolders: string[] = [];
  const openExpanded: boolean[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let depth = 0;

    if (mode === 'tree') {
      const folders = parts.slice(0, -1);
      let shared = 0;
      while (
        shared < openFolders.length &&
        shared < folders.length &&
        openFolders[shared] === folders[shared]
      ) {
        shared++;
      }
      openFolders.length = shared;
      openExpanded.length = shared;

      for (let i = shared; i < folders.length; i++) {
        const path = folders.slice(0, i + 1).join('/');
        if (openExpanded.every(Boolean)) {
          rows.push({ kind: 'folder', key: `d:${path}`, path, name: folders[i], depth: i });
        }
        openFolders.push(folders[i]);
        openExpanded.push(isExpanded(path));
      }

      if (!openExpanded.every(Boolean)) continue;
      depth = folders.length;
    }

    rows.push({
      kind: 'file',
      key: `f:${file.path}`,
      path: file.path,
      name: mode === 'tree' ? parts[parts.length - 1] : file.path,
      depth,
      file,
    });
    if (isExpanded(file.path)) {
      file.matches.forEach((match, i) =>
        rows.push({
          kind: 'match',
          key: `m:${file.path}#${i}`,
          depth: depth + 1,
          filePath: file.path,
          match,
        }),
      );
    }
  }

  return rows;
}

export function countMatches(files: readonly FileMatches[]): number {
  return files.reduce((n, f) => n + f.matches.length, 0);
}
