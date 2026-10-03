import { describe, expect, it } from 'vitest';
import { findBestMatch, foldCase, nextMatch } from '../src/helpers/match';

const text = 'const Total = 1;\nlet subtotal = total + 2;\nreturn total;\n';
const at = (needle: string, nth = 0): number => {
  let index = -1;
  for (let i = 0; i <= nth; i++) index = text.indexOf(needle, index + 1);
  return index;
};

describe('findBestMatch', () => {
  it('returns nothing for an empty query', () => {
    expect(findBestMatch(text, '', 0)).toBeNull();
  });

  it('prefers an exact-case whole word over other occurrences', () => {
    expect(findBestMatch(text, 'Total', 0)).toEqual({ from: at('Total'), to: at('Total') + 5 });
  });

  it('prefers a whole word over a substring of a longer word', () => {
    const from = at('total', 1);
    expect(findBestMatch(text, 'total', 0)).toEqual({ from, to: from + 5 });
  });

  it('picks the nearest occurrence after the anchor among equal matches, wrapping around', () => {
    const second = at('total', 2);
    expect(findBestMatch(text, 'total', at('total', 1) + 1)).toEqual({
      from: second,
      to: second + 5,
    });
    expect(findBestMatch(text, 'total', text.length)?.from).toBe(at('total', 1));
  });

  it('matches case-insensitively', () => {
    expect(findBestMatch(text, 'TOTAL', 0)?.from).toBe(at('Total'));
  });

  it('falls back to the best fuzzy line match when no substring occurs', () => {
    const match = findBestMatch(text, 'sbttl', 0);
    expect(match).not.toBeNull();
    if (!match) throw new Error('expected a fuzzy match');
    expect(text.slice(match.from, match.to)).toBe('subtotal');
  });

  it('returns nothing when not even a fuzzy match exists', () => {
    expect(findBestMatch(text, 'xyz', 0)).toBeNull();
  });

  it('accepts a precomputed case fold', () => {
    const folded = foldCase(text);
    expect(findBestMatch(text, 'return', 0, folded)?.from).toBe(at('return'));
  });
});

describe('nextMatch', () => {
  const first = { from: at('total', 1), to: at('total', 1) + 5 };

  it('steps forward through the occurrences and wraps to the first one', () => {
    const second = nextMatch(text, 'total', first, 1);
    expect(second?.from).toBe(at('total', 2));
    if (!second) throw new Error('expected a second match');
    expect(nextMatch(text, 'total', second, 1)?.from).toBe(at('Total'));
  });

  it('steps backward and wraps to the last one', () => {
    expect(nextMatch(text, 'total', first, -1)?.from).toBe(at('total', 0));
    const start = { from: at('Total'), to: at('Total') + 5 };
    expect(nextMatch(text, 'total', start, -1)?.from).toBe(at('total', 2));
  });

  it('returns nothing when the query has no occurrence', () => {
    expect(nextMatch(text, 'xyz', first, 1)).toBeNull();
  });
});

describe('foldCase', () => {
  it('lower-cases text whose length does not change', () => {
    expect(foldCase('AbC')).toBe('abc');
  });

  it('keeps the original text when lower-casing would shift offsets', () => {
    expect(foldCase('İx')).toBe('İx');
  });
});
