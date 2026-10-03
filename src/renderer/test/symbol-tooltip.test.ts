import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { hoveredSymbol } from '../src/components/CodeEditor';

const doc = 'const total = count + 42;\nreturn total;';
const state = EditorState.create({ doc });

describe('hoveredSymbol', () => {
  it('returns the identifier under the pointer with its 1-based line and column', () => {
    expect(hoveredSymbol(state, doc.indexOf('count') + 2, 1)).toEqual({
      name: 'count',
      from: 14,
      to: 19,
      line: 1,
      col: 15,
    });
    expect(hoveredSymbol(state, doc.indexOf('return') + 1, 1)?.line).toBe(2);
  });

  it('returns nothing for whitespace, punctuation and numbers', () => {
    expect(hoveredSymbol(state, doc.indexOf(' = ') + 1, 1)).toBeNull();
    expect(hoveredSymbol(state, doc.indexOf('+'), 1)).toBeNull();
    expect(hoveredSymbol(state, doc.indexOf('42'), 1)).toBeNull();
  });

  it('respects which side of the position the pointer is on at a word boundary', () => {
    const from = doc.indexOf('count');
    const to = from + 'count'.length;
    expect(hoveredSymbol(state, from, -1)).toBeNull();
    expect(hoveredSymbol(state, from, 1)?.name).toBe('count');
    expect(hoveredSymbol(state, to, 1)).toBeNull();
    expect(hoveredSymbol(state, to, -1)?.name).toBe('count');
  });
});
