import { describe, expect, it } from 'vitest';
import type { DocumentSymbol } from '@gepard/common';
import { changedLeaves, type RowData } from '../src/helpers/row';
import { buildFlatList, buildTree, symbolTreeNodes } from '../src/helpers/tree';

const row = (totalCount: number): RowData => ({
  additions: 0,
  deletions: 0,
  viewedCount: 0,
  totalCount,
});

describe('changedLeaves', () => {
  it('lists only files with changes, recursing into folders', () => {
    const tree = buildTree([
      { path: 'src/a.ts', data: row(2) },
      { path: 'src/b.ts', data: row(0) },
      { path: 'c.ts', data: row(1) },
    ]);
    expect(tree.flatMap(changedLeaves)).toEqual(['src/a.ts', 'c.ts']);
  });
});

describe('buildFlatList', () => {
  it('returns sorted leaf nodes named by full path', () => {
    const list = buildFlatList([
      { path: 'b/x.ts', data: 1 },
      { path: 'a.ts', data: 2 },
    ]);
    expect(list.map((n) => n.path)).toEqual(['a.ts', 'b/x.ts']);
    expect(list[1]).toMatchObject({ name: 'b/x.ts', isFolder: false, children: [], data: 1 });
  });
});

describe('symbolTreeNodes', () => {
  const range = (line: number): DocumentSymbol['range'] => ({
    start: { line, col: 1 },
    end: { line, col: 2 },
  });
  const symbols: DocumentSymbol[] = [
    {
      name: 'A',
      kind: 'class',
      range: range(1),
      selectionRange: range(2),
      children: [
        { name: 'm', kind: 'method', range: range(3), selectionRange: range(4), children: [] },
      ],
    },
  ];

  it('builds nested nodes with index-based paths and the selection line', () => {
    const [node] = symbolTreeNodes(symbols, 'f.ts');
    expect(node).toMatchObject({ path: 'f.ts/0:A', data: { kind: 'class', line: 2 } });
    expect(node.children[0]).toMatchObject({ path: 'f.ts/0:A/0:m', data: { line: 4 } });
  });

  it('returns an empty list for no symbols', () => {
    expect(symbolTreeNodes([], 'f.ts')).toEqual([]);
  });
});
