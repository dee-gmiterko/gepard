import { describe, expect, it } from 'vitest';
import { digestPaths } from '../src/helpers/pathsDigest';

describe('digestPaths', () => {
  it('is stable for the same list', () => {
    expect(digestPaths(['a.ts', 'b/c.ts'])).toBe(digestPaths(['a.ts', 'b/c.ts']));
  });

  it('differs when a path, the order or the length differs', () => {
    const base = digestPaths(['a.ts', 'b.ts']);
    expect(digestPaths(['a.ts', 'c.ts'])).not.toBe(base);
    expect(digestPaths(['b.ts', 'a.ts'])).not.toBe(base);
    expect(digestPaths(['a.ts'])).not.toBe(base);
  });

  it('does not confuse where one path ends and the next begins', () => {
    expect(digestPaths(['ab', 'c'])).not.toBe(digestPaths(['a', 'bc']));
  });

  it('is short however long the list is', () => {
    const paths = Array.from({ length: 5000 }, (_, i) => `src/dir${i}/file${i}.ts`);
    expect(digestPaths(paths).length).toBeLessThan(40);
  });

  it('handles an empty list', () => {
    expect(digestPaths([])).toMatch(/^0:/);
  });
});
