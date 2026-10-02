import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../helpers/async';

describe('mapWithConcurrency', () => {
  it('keeps result order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([30, 5, 20, 1], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, n));
      active--;
      return n * 2;
    });
    expect(out).toEqual([60, 10, 40, 2]);
    expect(peak).toBe(2);
  });

  it('returns an empty list for no items', async () => {
    expect(await mapWithConcurrency([], 3, (n: number) => Promise.resolve(n))).toEqual([]);
  });
});
