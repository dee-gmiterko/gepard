import { describe, expect, it } from 'vitest';
import { firstFileToReview, nextTargetedFile } from '../src/helpers/targetedFiles';

const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];

describe('nextTargetedFile', () => {
  it('returns null for an empty list', () => {
    expect(nextTargetedFile([], null, new Set(), 1)).toBeNull();
  });

  it('moves to the next file in the list', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(), 1)).toBe('b.ts');
  });

  it('moves to the previous file in the list', () => {
    expect(nextTargetedFile(files, 'b.ts', new Set(), -1)).toBe('a.ts');
  });

  it('wraps around at the ends', () => {
    expect(nextTargetedFile(files, 'd.ts', new Set(), 1)).toBe('a.ts');
    expect(nextTargetedFile(files, 'a.ts', new Set(), -1)).toBe('d.ts');
  });

  it('skips viewed files', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(['b.ts']), 1)).toBe('c.ts');
  });

  it('returns null when every other file is viewed', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(['b.ts', 'c.ts', 'd.ts']), 1)).toBeNull();
  });

  it('starts before the first file going down with no active file', () => {
    expect(nextTargetedFile(files, null, new Set(), 1)).toBe('a.ts');
  });

  it('starts after the last file going up with no active file', () => {
    expect(nextTargetedFile(files, null, new Set(), -1)).toBe('d.ts');
  });

  it('starts before the first file going down when the active file is not in the list', () => {
    expect(nextTargetedFile(files, 'missing.ts', new Set(), 1)).toBe('a.ts');
  });
});

describe('firstFileToReview', () => {
  const files = ['a.ts', 'b.ts', 'c.ts'];

  it('starts at the first unviewed file', () => {
    expect(firstFileToReview(files, new Set(['a.ts']))).toBe('b.ts');
  });

  it('falls back to the first file when all are viewed', () => {
    expect(firstFileToReview(files, new Set(files))).toBe('a.ts');
  });

  it('is null without files', () => {
    expect(firstFileToReview([], new Set())).toBeNull();
  });
});
