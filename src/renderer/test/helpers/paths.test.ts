import { describe, expect, it } from 'vitest';
import { basename, foldersOf, isValidRepoPath } from '../../src/helpers/paths';

describe('foldersOf', () => {
  it('lists every ancestor folder once, sorted', () => {
    expect(foldersOf(['src/a/x.ts', 'src/b.ts', 'README.md'])).toEqual(['src', 'src/a']);
  });

  it('returns nothing for root-level files', () => {
    expect(foldersOf(['a.ts'])).toEqual([]);
  });
});

describe('basename', () => {
  it('returns the last segment', () => {
    expect(basename('a/b/c.ts')).toBe('c.ts');
    expect(basename('c.ts')).toBe('c.ts');
  });
});

describe('isValidRepoPath', () => {
  it('accepts relative repository paths', () => {
    expect(isValidRepoPath('package.json')).toBe(true);
    expect(isValidRepoPath('src/main')).toBe(true);
  });

  it('accepts any characters valid in a file name and rejects the empty path', () => {
    expect(isValidRepoPath('src\\main')).toBe(true);
    expect(isValidRepoPath('a\nb')).toBe(true);
    expect(isValidRepoPath('')).toBe(false);
  });
});
