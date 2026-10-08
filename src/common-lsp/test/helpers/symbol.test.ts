import { describe, expect, it } from 'vitest';
import type { SourceDocumentSymbol } from '@gepard/common';
import { findSymbolAt } from '@gepard/common-lsp';

const sym = (
  name: string,
  kind: SourceDocumentSymbol['kind'],
  line: number,
  children: SourceDocumentSymbol[] = [],
): SourceDocumentSymbol => {
  const range = { start: { line, col: 1 }, end: { line, col: 10 } };
  return { name, kind, range, selectionRange: range, children };
};

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
