import { describe, expect, it } from 'vitest';
import { escapeRegExp } from '../src/helpers/string';

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so the text matches literally', () => {
    const text = 'a.b*c(d)[e]';
    expect(new RegExp(escapeRegExp(text)).test(text)).toBe(true);
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false);
  });
});
