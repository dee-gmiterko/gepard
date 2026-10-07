import { describe, expect, it } from 'vitest';
import { identifiersOn } from '../../helpers/identifier';

describe('identifiersOn', () => {
  it('returns identifiers with zero-based columns, skipping keywords', () => {
    expect(identifiersOn('var foo = bar')).toEqual([
      { name: 'foo', col0: 4 },
      { name: 'bar', col0: 10 },
    ]);
  });

  it('ignores strings, comments and node paths after $', () => {
    expect(identifiersOn('x = "skip" # hidden')).toEqual([{ name: 'x', col0: 0 }]);
    expect(identifiersOn('$Node + y')).toEqual([{ name: 'y', col0: 8 }]);
  });
});
