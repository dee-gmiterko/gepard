import { describe, expect, it } from 'vitest';
import type { SourceDocumentSymbol } from '@gepard/common';
import { symbolKind, unwrapFileSymbol } from '../../helpers/symbol';

const sym = (
  name: string,
  kind: SourceDocumentSymbol['kind'],
  line: number,
  children: SourceDocumentSymbol[] = [],
): SourceDocumentSymbol => {
  const range = { start: { line, col: 1 }, end: { line, col: 10 } };
  return { name, kind, range, selectionRange: range, children };
};

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
