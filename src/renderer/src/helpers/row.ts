import type { TreeNode } from './tree';

export interface RowData {
  additions: number;
  deletions: number;
  viewedCount: number;
  totalCount: number;
}

export const ZERO_ROW: RowData = { additions: 0, deletions: 0, viewedCount: 0, totalCount: 0 };

export function aggregateRows(children: RowData[]): RowData {
  return children.reduce(
    (sum, c) => ({
      additions: sum.additions + c.additions,
      deletions: sum.deletions + c.deletions,
      viewedCount: sum.viewedCount + c.viewedCount,
      totalCount: sum.totalCount + c.totalCount,
    }),
    ZERO_ROW,
  );
}

export function isViewedRow(data: RowData): boolean {
  return data.totalCount > 0 && data.viewedCount === data.totalCount;
}

export interface ChangedFileStat {
  path: string;
  additions: number;
  deletions: number;
}

export interface ViewedEntry {
  path: string;
  viewed: boolean;
}

export function rowsByPath(
  changedFiles: readonly ChangedFileStat[],
  viewedList: readonly ViewedEntry[],
): Map<string, RowData> {
  const viewed = new Set(viewedList.filter((v) => v.viewed).map((v) => v.path));
  const rows = new Map<string, RowData>();
  for (const f of changedFiles) {
    const file: RowData = {
      additions: f.additions,
      deletions: f.deletions,
      viewedCount: viewed.has(f.path) ? 1 : 0,
      totalCount: 1,
    };
    rows.set(f.path, file);
    let folder = f.path;
    for (let cut = folder.lastIndexOf('/'); cut >= 0; cut = folder.lastIndexOf('/')) {
      folder = folder.slice(0, cut);
      rows.set(folder, aggregateRows([rows.get(folder) ?? ZERO_ROW, file]));
    }
    rows.set('', aggregateRows([rows.get('') ?? ZERO_ROW, file]));
  }
  return rows;
}

export function changedLeaves(
  node: TreeNode<unknown>,
  rows: ReadonlyMap<string, RowData>,
): string[] {
  if (!node.isFolder) return (rows.get(node.path)?.totalCount ?? 0) > 0 ? [node.path] : [];
  return node.children.flatMap((child) => changedLeaves(child, rows));
}
