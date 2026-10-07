import { describe, expect, it } from 'vitest';
import { unionByKey } from '../../src/helpers/array';

describe('unionByKey', () => {
  it('keeps the first item per key in order', () => {
    const out = unionByKey(
      [{ k: 'a', v: 1 }],
      [
        { k: 'a', v: 2 },
        { k: 'b', v: 3 },
      ],
      (i) => i.k,
    );
    expect(out).toEqual([
      { k: 'a', v: 1 },
      { k: 'b', v: 3 },
    ]);
  });
});
