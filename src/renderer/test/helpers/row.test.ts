import { describe, expect, it } from 'vitest';
import { buildTree } from '../../src/helpers/tree';
import { changedLeaves, isViewedRow, rowsByPath, type RowData } from '../../src/helpers/row';

function row(viewed: boolean, totalCount = 1): RowData {
  return { additions: 1, deletions: 0, viewedCount: viewed ? totalCount : 0, totalCount };
}

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

const changed = [
  { path: 'src/a.ts', additions: 3, deletions: 1 },
  { path: 'src/deep/b.ts', additions: 2, deletions: 0 },
  { path: 'README.md', additions: 1, deletions: 4 },
];

describe('rowsByPath', () => {
  const viewed = [
    { path: 'src/a.ts', viewed: true },
    { path: 'README.md', viewed: false },
  ];
  const rows = rowsByPath(changed, viewed);

  it('keys file rows by path with their counts and viewed state', () => {
    expect(rows.get('src/a.ts')).toEqual({
      additions: 3,
      deletions: 1,
      viewedCount: 1,
      totalCount: 1,
    });
    expect(rows.get('README.md')).toMatchObject({ viewedCount: 0, totalCount: 1 });
  });

  it('totals every ancestor folder and the root', () => {
    expect(rows.get('src')).toEqual({ additions: 5, deletions: 1, viewedCount: 1, totalCount: 2 });
    expect(rows.get('src/deep')).toMatchObject({ additions: 2, totalCount: 1 });
    expect(rows.get('')).toEqual({ additions: 6, deletions: 5, viewedCount: 1, totalCount: 3 });
  });

  it('has no entry for paths outside the diff', () => {
    expect(rows.get('docs')).toBeUndefined();
  });

  it('updates viewed counts without touching the tree structure', () => {
    const tree = buildTree(changed.map((f) => f.path));
    const next = rowsByPath(changed, [...viewed, { path: 'src/deep/b.ts', viewed: true }]);
    expect(next.get('src')?.viewedCount).toBe(2);
    expect(buildTree(changed.map((f) => f.path))).toEqual(tree);
  });
});

describe('changedLeaves', () => {
  it('lists only files with changes, recursing into folders', () => {
    const rows = rowsByPath([{ path: 'src/a.ts', additions: 1, deletions: 0 }], []);
    const tree = buildTree(['src/a.ts', 'src/b.ts', 'c.ts']);
    expect(tree.flatMap((node) => changedLeaves(node, rows))).toEqual(['src/a.ts']);
  });
});
