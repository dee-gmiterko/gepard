import { describe, expect, it } from 'vitest';
import { identifiersOn } from '@gepard/common-lsp';
import { GDSCRIPT_SYNTAX } from '../../helpers/identifier';

describe('GDSCRIPT_SYNTAX', () => {
  it('returns identifiers with zero-based columns, skipping keywords', () => {
    expect(identifiersOn('var foo = bar', GDSCRIPT_SYNTAX)).toEqual([
      { name: 'foo', col0: 4 },
      { name: 'bar', col0: 10 },
    ]);
  });

  it('ignores strings, comments and node paths after $', () => {
    expect(identifiersOn('x = "skip" # hidden', GDSCRIPT_SYNTAX)).toEqual([{ name: 'x', col0: 0 }]);
    expect(identifiersOn('$Node + y', GDSCRIPT_SYNTAX)).toEqual([{ name: 'y', col0: 8 }]);
  });
});
