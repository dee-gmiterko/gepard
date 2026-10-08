import { describe, expect, it } from 'vitest';
import { identifiersOn, type IdentifierSyntax } from '@gepard/common-lsp';

const syntax: IdentifierSyntax = { keywords: new Set(['def', 'return']), lineComment: '#' };

describe('identifiersOn', () => {
  it('returns identifiers with zero-based columns, skipping keywords', () => {
    expect(identifiersOn('def add(item):', syntax)).toEqual([
      { name: 'add', col0: 4 },
      { name: 'item', col0: 8 },
    ]);
  });

  it('ignores strings, escaped quotes and comments', () => {
    expect(identifiersOn('x = "a \\" b" # hidden', syntax)).toEqual([{ name: 'x', col0: 0 }]);
  });

  it('skips string prefixes', () => {
    expect(identifiersOn('return f"{y}"', syntax)).toEqual([]);
  });

  it('skips names after the configured character only', () => {
    expect(identifiersOn('$a + b', syntax).map((i) => i.name)).toEqual(['a', 'b']);
    expect(identifiersOn('$a + b', { ...syntax, skipAfter: '$' }).map((i) => i.name)).toEqual([
      'b',
    ]);
  });
});
