import { describe, expect, it } from 'vitest';
import {
  decodeLineSymbols,
  emptyLegend,
  mapSemanticTokenType,
  semanticTokensSupportOf,
} from '../../helpers/semanticToken';

describe('emptyLegend', () => {
  it('returns a fresh legend with no entries', () => {
    expect(emptyLegend()).toEqual({ tokenTypes: [], tokenModifiers: [] });
    expect(emptyLegend()).not.toBe(emptyLegend());
  });
});

describe('mapSemanticTokenType', () => {
  it('maps known types and aliases', () => {
    expect(mapSemanticTokenType('class', false)).toBe('class');
    expect(mapSemanticTokenType('struct', false)).toBe('type');
  });

  it('maps readonly variables to constants', () => {
    expect(mapSemanticTokenType('variable', true)).toBe('constant');
    expect(mapSemanticTokenType('variable', false)).toBe('variable');
  });

  it('falls back to unknown', () => {
    expect(mapSemanticTokenType(undefined, false)).toBe('unknown');
    expect(mapSemanticTokenType('keyword', false)).toBe('unknown');
  });
});

describe('decodeLineSymbols', () => {
  const legend = {
    tokenTypes: ['function', 'variable'],
    tokenModifiers: ['declaration', 'readonly', 'custom'],
  };
  const data = [0, 0, 3, 0, 1, 1, 2, 3, 1, 2, 0, 4, 2, 0, 4];

  it('decodes names, kinds, modifiers and ranges for the first line', () => {
    expect(decodeLineSymbols(data, legend, 1, 'foo bar')).toEqual([
      {
        name: 'foo',
        kind: 'function',
        modifiers: ['declaration'],
        range: { start: { line: 1, col: 1 }, end: { line: 1, col: 4 } },
      },
    ]);
  });

  it('applies relative offsets and drops unknown modifiers', () => {
    const out = decodeLineSymbols(data, legend, 2, 'xxabc ab');
    expect(out.map((s) => [s.name, s.kind, s.modifiers])).toEqual([
      ['abc', 'constant', ['readonly']],
      ['ab', 'function', []],
    ]);
    expect(out[0].range.start.col).toBe(3);
  });

  it('returns nothing for a line without tokens', () => {
    expect(decodeLineSymbols(data, legend, 3, 'none')).toEqual([]);
  });
});

describe('semanticTokensSupportOf', () => {
  const legend = { tokenTypes: ['class'], tokenModifiers: [] };
  const withProvider = (provider: object): unknown => ({
    capabilities: { semanticTokensProvider: { legend, ...provider } },
  });

  it('prefers range when the server advertises it', () => {
    expect(semanticTokensSupportOf(withProvider({ range: true, full: true }))).toEqual({
      legend,
      request: 'range',
    });
  });

  it('falls back to full when range is not advertised', () => {
    expect(semanticTokensSupportOf(withProvider({ full: { delta: true } })).request).toBe('full');
    expect(semanticTokensSupportOf(withProvider({ range: false, full: true })).request).toBe(
      'full',
    );
  });

  it('reports no support when the server has no provider', () => {
    expect(semanticTokensSupportOf({ capabilities: {} })).toEqual({
      legend: emptyLegend(),
      request: null,
    });
    expect(semanticTokensSupportOf(withProvider({})).request).toBeNull();
  });
});
