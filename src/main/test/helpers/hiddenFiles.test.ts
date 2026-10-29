import { describe, expect, it } from 'vitest';
import {
  compileHiddenPatterns,
  filterHiddenPaths,
  mergeHiddenPatterns,
} from '../../helpers/hiddenFiles';

describe('compileHiddenPatterns', () => {
  it('skips invalid and blank patterns without throwing', () => {
    const compiled = compileHiddenPatterns(['(', '', '  ', '\\.lock$']);
    expect(compiled.map((r) => r.source)).toEqual(['\\.lock$']);
  });
});

describe('mergeHiddenPatterns', () => {
  it('unions global and project patterns without duplicates', () => {
    expect(mergeHiddenPatterns(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('filterHiddenPaths', () => {
  const paths = ['src/a.ts', 'yarn.lock', 'dist/out.js', 'docs/readme.md'];

  it('drops paths matching any merged pattern', () => {
    const patterns = compileHiddenPatterns(mergeHiddenPatterns(['\\.lock$'], ['^dist/']));
    expect(filterHiddenPaths(paths, patterns, (p) => p)).toEqual(['src/a.ts', 'docs/readme.md']);
  });

  it('keeps everything when no pattern is valid', () => {
    const patterns = compileHiddenPatterns(['(', '[']);
    expect(filterHiddenPaths(paths, patterns, (p) => p)).toEqual(paths);
  });

  it('reads the path from objects', () => {
    const files = [{ path: 'a.lock' }, { path: 'b.ts' }];
    const patterns = compileHiddenPatterns(['\\.lock$']);
    expect(filterHiddenPaths(files, patterns, (f) => f.path)).toEqual([{ path: 'b.ts' }]);
  });
});
