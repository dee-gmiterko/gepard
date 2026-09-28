import { describe, expect, it } from 'vitest';
import { comparePaths } from '@gepard/common/model/pathOrder';

describe('comparePaths', () => {
  it('orders by path component, so a folder sorts by its name, not by the next character', () => {
    const paths = ['a.txt', 'a/x.txt', 'a-b.txt', 'b/c.txt', 'a/b/y.txt'];
    expect([...paths].sort(comparePaths)).toEqual([
      'a/b/y.txt',
      'a/x.txt',
      'a-b.txt',
      'a.txt',
      'b/c.txt',
    ]);
  });

  it('keeps every folder’s contents together', () => {
    const paths = ['src/z.ts', 'src/a/x.ts', 'src.ts', 'src/a.ts', 'src/a/b/y.ts'];
    expect([...paths].sort(comparePaths)).toEqual([
      'src/a/b/y.ts',
      'src/a/x.ts',
      'src/a.ts',
      'src/z.ts',
      'src.ts',
    ]);
  });

  it('is zero for equal paths and puts a prefix before its extension', () => {
    expect(comparePaths('a/b', 'a/b')).toBe(0);
    expect(comparePaths('a', 'a/b')).toBeLessThan(0);
    expect(comparePaths('a/b', 'a')).toBeGreaterThan(0);
  });

  it('compares by code unit, not by locale', () => {
    expect(comparePaths('B.ts', 'a.ts')).toBeLessThan(0);
  });
});
