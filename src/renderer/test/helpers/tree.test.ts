import { describe, expect, it } from 'vitest';
import type { DocumentSymbol } from '@gepard/common';
import {
  buildFlatList,
  buildTree,
  flattenVisible,
  symbolTreeNodes,
  withRoot,
} from '../../src/helpers/tree';

describe('buildTree', () => {
  const entries = buildTree(['src/a.ts', 'src/b.ts', 'README.md']);

  it('nests files under folders, folders first, with no row data', () => {
    expect(entries.map((n) => n.name)).toEqual(['src', 'README.md']);
    expect(entries[0].children.map((n) => n.path)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(entries[0].data).toBeUndefined();
    expect(entries[1]).toMatchObject({ isFolder: false, children: [] });
  });
});

describe('withRoot', () => {
  const entries = buildTree(['src/a.ts', 'src/b.ts', 'README.md']);

  it('wraps the top-level entries in one folder named after the project', () => {
    const [root, ...rest] = withRoot(entries, 'gepard');
    expect(rest).toEqual([]);
    expect(root.name).toBe('gepard');
    expect(root.path).toBe('');
    expect(root.isFolder).toBe(true);
    expect(root.children).toBe(entries);
    expect(root.data).toBeUndefined();
  });
});

describe('buildFlatList', () => {
  it('returns sorted leaf nodes named by full path', () => {
    const list = buildFlatList(['b/x.ts', 'a.ts']);
    expect(list.map((n) => n.path)).toEqual(['a.ts', 'b/x.ts']);
    expect(list[1]).toMatchObject({ name: 'b/x.ts', isFolder: false, children: [] });
  });
});

describe('flattenVisible', () => {
  const nodes = withRoot(buildTree(['src/a.ts', 'src/b.ts', 'README.md']), 'gepard');

  it('lists every row with depth, parent and position in set', () => {
    const rows = flattenVisible(nodes, new Set());
    expect(rows.map((r) => r.node.path)).toEqual(['', 'src', 'src/a.ts', 'src/b.ts', 'README.md']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 2, 1]);
    expect(rows.map((r) => r.parentIndex)).toEqual([-1, 0, 1, 1, 0]);
    expect(rows[3]).toMatchObject({ position: 2, setSize: 2 });
  });

  it('omits the descendants of collapsed folders', () => {
    const rows = flattenVisible(nodes, new Set(['src']));
    expect(rows.map((r) => r.node.path)).toEqual(['', 'src', 'README.md']);
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
