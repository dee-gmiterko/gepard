import { describe, expect, it } from 'vitest';
import { byteOffsetToUtf16, identifierAt, oneLine, utf16ByteBoundaries } from '../helpers/string';

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

describe('utf16ByteBoundaries / byteOffsetToUtf16', () => {
  it('maps ASCII text 1:1 (bytes === UTF-16 units)', () => {
    const boundaries = utf16ByteBoundaries('hello');
    expect(boundaries).toEqual([0, 1, 2, 3, 4, 5]);
    expect(byteOffsetToUtf16(boundaries, 3)).toBe(3);
  });

  it('maps an astral character (surrogate pair, 4 UTF-8 bytes) to 2 UTF-16 units', () => {
    const text = '\u{1F600} smile';
    const boundaries = utf16ByteBoundaries(text);
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(3);
    expect(byteOffsetToUtf16(boundaries, 10)).toBe(8);
  });

  it('maps a BMP multi-byte character (e.g. "é", 2 UTF-8 bytes, 1 UTF-16 unit)', () => {
    const text = 'café bar';
    const boundaries = utf16ByteBoundaries(text);
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(4);
  });
});
