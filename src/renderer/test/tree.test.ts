import { describe, expect, it } from 'vitest';
import type { DocumentSymbol } from '@gepard/common';
import { buildFlatList, buildTree, symbolTreeNodes, withRoot } from '../src/helpers/tree';

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

describe('withRoot', () => {
  const entries = buildTree(
    [
      { path: 'src/a.ts', data: 1 },
      { path: 'src/b.ts', data: 2 },
      { path: 'README.md', data: 4 },
    ],
    { aggregateFolder: sum },
  );

  it('wraps the top-level entries in one folder named after the project', () => {
    const [root, ...rest] = withRoot(entries, 'gepard', { aggregateFolder: sum });
    expect(rest).toEqual([]);
    expect(root.name).toBe('gepard');
    expect(root.path).toBe('');
    expect(root.isFolder).toBe(true);
    expect(root.children).toBe(entries);
    expect(root.children.map((n) => n.name)).toEqual(['src', 'README.md']);
  });

  it('aggregates the root data from its children', () => {
    const [root] = withRoot(entries, 'gepard', { aggregateFolder: sum });
    expect(root.data).toBe(7);
  });

  it('leaves data undefined without an aggregator', () => {
    const [root] = withRoot(entries, 'gepard');
    expect(root.data).toBeUndefined();
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
