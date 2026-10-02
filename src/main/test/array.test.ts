import { describe, expect, it } from 'vitest';
import { chunk } from '../helpers/array';

describe('chunk', () => {
  it('splits into groups with a shorter last group', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no groups for an empty list', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
