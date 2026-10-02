import { describe, expect, it } from 'vitest';
import { withBatches } from '../helpers/async';

describe('withBatches', () => {
  it('splits items into chunks of the given size', async () => {
    const seen: number[][] = [];
    await withBatches([1, 2, 3, 4, 5], 2, (batch) => {
      seen.push(batch);
      return Promise.resolve();
    });
    expect(seen).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('runs a single batch when items fit within the size', async () => {
    const seen: number[][] = [];
    await withBatches([1, 2], 5, (batch) => {
      seen.push(batch);
      return Promise.resolve();
    });
    expect(seen).toEqual([[1, 2]]);
  });

  it('calls fn zero times for an empty list', async () => {
    const seen: number[][] = [];
    await withBatches<number, void>([], 5, (batch) => {
      seen.push(batch);
      return Promise.resolve();
    });
    expect(seen).toEqual([]);
  });

  it('awaits each batch before starting the next', async () => {
    const order: string[] = [];
    await withBatches([1, 2, 3, 4], 2, async (batch) => {
      order.push(`start:${batch.join(',')}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(`end:${batch.join(',')}`);
    });
    expect(order).toEqual(['start:1,2', 'end:1,2', 'start:3,4', 'end:3,4']);
  });

  it('collects the return value of each batch call, in order', async () => {
    const results = await withBatches([1, 2, 3, 4, 5], 2, (batch) =>
      Promise.resolve(batch.reduce((a, b) => a + b, 0)),
    );
    expect(results).toEqual([3, 7, 5]);
  });
});
