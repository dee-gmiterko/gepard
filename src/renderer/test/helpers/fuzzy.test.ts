import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch, fuzzyRanges } from '../../src/helpers/fuzzy';

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively and reports indices', () => {
    expect(fuzzyMatch('ab', 'xAxB')?.indices).toEqual([1, 3]);
  });

  it('scores consecutive and early matches higher', () => {
    const tight = fuzzyMatch('ab', 'ab');
    const loose = fuzzyMatch('ab', 'a--b');
    expect(tight?.score).toBeGreaterThan(loose?.score ?? Infinity);
  });

  it('returns null when the query is not a subsequence and an empty match for no query', () => {
    expect(fuzzyMatch('ba', 'ab')).toBeNull();
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] });
  });
});

describe('fuzzyFilter', () => {
  it('drops non-matches and ranks the best match first', () => {
    expect(fuzzyFilter(['a--b', 'ab', 'zz'], 'ab', (s) => s)).toEqual(['ab', 'a--b']);
  });

  it('returns a copy of all items for a blank query', () => {
    const items = ['x', 'y'];
    const out = fuzzyFilter(items, '  ', (s) => s);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
});

describe('fuzzyRanges', () => {
  it('merges adjacent indices into ranges', () => {
    expect(fuzzyRanges('abd', 'abcd')).toEqual([
      [0, 2],
      [3, 4],
    ]);
  });

  it('returns no ranges for an empty query or no match', () => {
    expect(fuzzyRanges('', 'abc')).toEqual([]);
    expect(fuzzyRanges('z', 'abc')).toEqual([]);
  });
});
