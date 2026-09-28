import { describe, expect, it } from 'vitest';
import { findDiffDocLine } from '../src/renderer/src/components/CodeEditor/diffDecorations';

const infos = [
  { oldLine: 1, newLine: 1 },
  { oldLine: 10, newLine: null },
  { oldLine: null, newLine: 20 },
  { oldLine: 3, newLine: 3 },
];

describe('findDiffDocLine', () => {
  it('finds the doc line for an added (RIGHT-only) line number', () => {
    expect(findDiffDocLine(infos, 20, 'RIGHT')).toBe(3);
  });

  it('finds the doc line for a deleted (LEFT-only) line number', () => {
    expect(findDiffDocLine(infos, 10, 'LEFT')).toBe(2);
  });

  it('finds a context line the same way on either side', () => {
    expect(findDiffDocLine(infos, 3, 'LEFT')).toBe(4);
    expect(findDiffDocLine(infos, 3, 'RIGHT')).toBe(4);
  });

  it('returns null when the line does not exist on the requested side', () => {
    expect(findDiffDocLine(infos, 10, 'RIGHT')).toBeNull();
    expect(findDiffDocLine(infos, 20, 'LEFT')).toBeNull();
    expect(findDiffDocLine(infos, 99, 'RIGHT')).toBeNull();
  });
});
