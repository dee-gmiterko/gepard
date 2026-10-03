import { describe, expect, it } from 'vitest';
import { isFn } from '../helpers/type-guards';

describe('isFn', () => {
  it('is true only for functions', () => {
    expect(isFn(() => 1)).toBe(true);
    expect(isFn({})).toBe(false);
    expect(isFn(undefined)).toBe(false);
  });
});
