import { describe, expect, it } from 'vitest';
import type { DocumentSymbol } from '@gepard/common';
import { identifiersOn } from '../helpers/identifier';
import { freePort } from '../helpers/net';
import { findSymbolAt, symbolKind, unwrapFileSymbol } from '../helpers/symbol';

const sym = (
  name: string,
  kind: DocumentSymbol['kind'],
  line: number,
  children: DocumentSymbol[] = [],
): DocumentSymbol => {
  const range = { start: { line, col: 1 }, end: { line, col: 10 } };
  return { name, kind, range, selectionRange: range, children };
};

describe('identifiersOn', () => {
  it('returns identifiers with zero-based columns, skipping keywords', () => {
    expect(identifiersOn('var foo = bar')).toEqual([
      { name: 'foo', col0: 4 },
      { name: 'bar', col0: 10 },
    ]);
  });

  it('ignores strings, comments and node paths after $', () => {
    expect(identifiersOn('x = "skip" # hidden')).toEqual([{ name: 'x', col0: 0 }]);
    expect(identifiersOn('$Node + y')).toEqual([{ name: 'y', col0: 8 }]);
  });
});

describe('freePort', () => {
  it('resolves a usable port number', async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});

describe('symbolKind', () => {
  it('maps the Event kind to property and delegates the rest', () => {
    expect(symbolKind(24)).toBe('property');
    expect(symbolKind(12)).toBe('function');
    expect(symbolKind(999)).toBe('unknown');
  });
});

describe('unwrapFileSymbol', () => {
  it('returns the children of a single class starting on line 1', () => {
    const child = sym('m', 'method', 3);
    expect(unwrapFileSymbol([sym('File', 'class', 1, [child])])).toEqual([child]);
  });

  it('keeps other trees as they are', () => {
    const tree = [sym('File', 'class', 2, [sym('m', 'method', 3)])];
    expect(unwrapFileSymbol(tree)).toBe(tree);
    const two = [sym('a', 'class', 1), sym('b', 'class', 5)];
    expect(unwrapFileSymbol(two)).toBe(two);
  });
});

describe('findSymbolAt', () => {
  const inner = sym('inner', 'method', 4);
  const tree = [sym('outer', 'class', 1, [inner])];

  it('finds top-level and nested symbols by selection start', () => {
    expect(findSymbolAt(tree, { line: 1, col: 1 })?.name).toBe('outer');
    expect(findSymbolAt(tree, { line: 4, col: 1 })).toBe(inner);
  });

  it('returns null when nothing starts at the position', () => {
    expect(findSymbolAt(tree, { line: 9, col: 1 })).toBeNull();
    expect(findSymbolAt(tree, { line: 1, col: 2 })).toBeNull();
  });
});
