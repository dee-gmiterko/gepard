import { describe, expect, it } from 'vitest';
import { basename, foldersOf, isValidRepoPath } from '../src/helpers/paths';

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

  it('rejects absolute, backslash and parent-traversal paths', () => {
    expect(isValidRepoPath('/package.json')).toBe(false);
    expect(isValidRepoPath('src\\main')).toBe(false);
    expect(isValidRepoPath('../x')).toBe(false);
    expect(isValidRepoPath('a/../x')).toBe(false);
  });
});
