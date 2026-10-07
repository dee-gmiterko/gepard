import { describe, expect, it } from 'vitest';
import { TypeScriptSession } from '../session';
import {
  flatSymbolsToTree,
  isDocumentSymbolArray,
  mapLspSymbolKind,
  toDocumentSymbol,
  toLocations,
  toLspPosition,
  toRange,
} from '../helpers/lsp';

const lspRange = { start: { line: 0, character: 0 }, end: { line: 1, character: 4 } };

describe('toLspPosition', () => {
  it('converts one-based line and column to zero-based', () => {
    expect(toLspPosition({ line: 1, col: 1 })).toEqual({ line: 0, character: 0 });
    expect(toLspPosition({ line: 5, col: 9 })).toEqual({ line: 4, character: 8 });
  });
});

describe('toRange', () => {
  it('converts zero-based lsp range to one-based range', () => {
    expect(toRange(lspRange)).toEqual({
      start: { line: 1, col: 1 },
      end: { line: 2, col: 5 },
    });
  });
});

describe('toLocations', () => {
  const loc = { uri: 'file:///a.ts', range: lspRange };

  it('returns an empty list for null', () => {
    expect(toLocations(null)).toEqual([]);
  });

  it('wraps a single location and keeps arrays', () => {
    expect(toLocations(loc)).toEqual([loc]);
    expect(toLocations([loc, loc])).toHaveLength(2);
  });

  it('maps location links preferring the selection range', () => {
    const selection = { start: { line: 2, character: 1 }, end: { line: 2, character: 3 } };
    expect(
      toLocations({
        targetUri: 'file:///b.ts',
        targetSelectionRange: selection,
        targetRange: lspRange,
      }),
    ).toEqual([{ uri: 'file:///b.ts', range: selection }]);
  });
});

describe('mapLspSymbolKind', () => {
  it('maps known kinds', () => {
    expect(mapLspSymbolKind(5)).toBe('class');
    expect(mapLspSymbolKind(2)).toBe('namespace');
    expect(mapLspSymbolKind(6)).toBe('method');
    expect(mapLspSymbolKind(14)).toBe('constant');
  });

  it('falls back to unknown', () => {
    expect(mapLspSymbolKind(999)).toBe('unknown');
  });
});

describe('isDocumentSymbolArray', () => {
  it('is true for an empty array and for document symbols', () => {
    expect(isDocumentSymbolArray([])).toBe(true);
    expect(
      isDocumentSymbolArray([{ name: 'a', kind: 5, range: lspRange, selectionRange: lspRange }]),
    ).toBe(true);
  });

  it('is false for symbol information', () => {
    expect(
      isDocumentSymbolArray([
        { name: 'a', kind: 5, location: { uri: 'file:///a', range: lspRange } },
      ]),
    ).toBe(false);
  });
});

describe('toDocumentSymbol', () => {
  const symbol = {
    name: 'A',
    kind: 5,
    range: lspRange,
    selectionRange: lspRange,
    children: [{ name: 'b', kind: 6, range: lspRange, selectionRange: lspRange }],
  };

  it('converts recursively with the default kind mapper', () => {
    const out = toDocumentSymbol(symbol);
    expect(out.kind).toBe('class');
    expect(out.children[0]).toMatchObject({ name: 'b', kind: 'method', children: [] });
    expect(out.range.start).toEqual({ line: 1, col: 1 });
  });

  it('uses a custom kind mapper', () => {
    expect(toDocumentSymbol(symbol, () => 'enum').children[0].kind).toBe('enum');
  });
});

describe('flatSymbolsToTree', () => {
  const at = { uri: 'file:///a', range: lspRange };

  it('nests symbols under their container by name', () => {
    const tree = flatSymbolsToTree([
      { name: 'A', kind: 5, location: at },
      { name: 'm', kind: 6, location: at, containerName: 'A' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.name)).toEqual(['m']);
  });

  it('keeps symbols with an unknown container as roots', () => {
    const tree = flatSymbolsToTree([
      { name: 'm', kind: 6, location: at, containerName: 'Missing' },
    ]);
    expect(tree.map((s) => s.name)).toEqual(['m']);
  });
});

describe('TypeScriptSession toRepoLocation', () => {
  const root = '/work/repo';
  // The method only reads the root, so the session is built without launching a server.
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  const session: {
    toRepoLocation(uri: string): { path: string; external: boolean };
  } = Object.assign(Object.create(TypeScriptSession.prototype), { spec: { root } });

  it('maps a file inside the root to a repo-relative path', () => {
    expect(session.toRepoLocation('file:///work/repo/src/a.txt')).toEqual({
      path: 'src/a.txt',
      external: false,
    });
  });

  it('marks a file outside the root as external', () => {
    expect(session.toRepoLocation('file:///opt/lib/b.txt')).toEqual({
      path: 'opt/lib/b.txt',
      external: true,
    });
  });

  it('does not treat a sibling directory sharing the root prefix as inside', () => {
    expect(session.toRepoLocation('file:///work/repo-other/c.txt').external).toBe(true);
  });

  it('returns a non-file definition uri as external instead of throwing', () => {
    expect(
      session.toRepoLocation(
        'zipfile:///home/u/.yarn/cache/typescript-npm-5.4.0.zip/node_modules/typescript/lib/lib.d.ts',
      ).external,
    ).toBe(true);
  });
});
