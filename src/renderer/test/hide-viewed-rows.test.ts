import { describe, expect, it } from 'vitest';
import { buildTree, flattenLeafPaths, withRoot } from '../src/helpers/tree';
import {
  aggregateRows,
  hideViewedRows,
  isViewedRow,
  viewedPercent,
  type RowData,
} from '../src/helpers/row';

function row(viewed: boolean, totalCount = 1): RowData {
  return { additions: 1, deletions: 0, viewedCount: viewed ? totalCount : 0, totalCount };
}

const items = [
  { path: 'src/a.ts', data: row(true) },
  { path: 'src/b.ts', data: row(false) },
  { path: 'docs/done.md', data: row(true) },
  { path: 'README.md', data: row(false) },
];

describe('isViewedRow', () => {
  it('is true only when every tracked file in the row is viewed', () => {
    expect(isViewedRow(row(true))).toBe(true);
    expect(isViewedRow(row(false))).toBe(false);
    expect(isViewedRow({ additions: 0, deletions: 0, viewedCount: 1, totalCount: 2 })).toBe(false);
  });

  it('never treats a file outside the diff (no tracked count) as viewed', () => {
    expect(isViewedRow({ additions: 0, deletions: 0, viewedCount: 0, totalCount: 0 })).toBe(false);
  });
});

describe('hideViewedRows', () => {
  it('returns the same list when hiding is off', () => {
    expect(hideViewedRows(items, false)).toBe(items);
  });

  it('drops viewed files when hiding is on', () => {
    expect(hideViewedRows(items, true).map((i) => i.path)).toEqual(['src/b.ts', 'README.md']);
  });

  it('drops folders left empty but keeps parents with unviewed files and the root', () => {
    const options = { aggregateFolder: aggregateRows };
    const [root] = withRoot(buildTree(hideViewedRows(items, true), options), 'gepard', options);
    expect(root.path).toBe('');
    expect(root.children.map((n) => n.name)).toEqual(['src', 'README.md']);
    expect(flattenLeafPaths([root])).toEqual(['src/b.ts', 'README.md']);
    expect(root.data).toEqual({ additions: 2, deletions: 0, viewedCount: 0, totalCount: 2 });
  });
});

describe('viewedPercent', () => {
  it('rounds the viewed share and is zero without tracked files', () => {
    expect(viewedPercent({ additions: 0, deletions: 0, viewedCount: 1, totalCount: 3 })).toBe(33);
    expect(viewedPercent({ additions: 0, deletions: 0, viewedCount: 0, totalCount: 0 })).toBe(0);
  });
});
