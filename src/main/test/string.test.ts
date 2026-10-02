import { describe, expect, it } from 'vitest';
import { identifierAt, oneLine } from '../helpers/string';

describe('oneLine', () => {
  it('replaces every line break style with a space', () => {
    expect(oneLine('a\nb\r\nc\rd')).toBe('a b c d');
  });

  it('leaves single-line text unchanged', () => {
    expect(oneLine('plain text')).toBe('plain text');
  });
});

describe('identifierAt', () => {
  it('returns the whole word around the column', () => {
    expect(identifierAt('const fooBar = 1;', 8)).toBe('fooBar');
    expect(identifierAt('const fooBar = 1;', 7)).toBe('fooBar');
  });

  it('includes underscores and dollar signs', () => {
    expect(identifierAt('$my_var + 1', 3)).toBe('$my_var');
  });

  it('returns the single character when not on a word', () => {
    expect(identifierAt('a + b', 3)).toBe('+');
  });
});
