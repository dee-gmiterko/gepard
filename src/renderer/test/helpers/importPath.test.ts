import { describe, expect, it } from 'vitest';
import { resolveImportPath } from '../../src/helpers/importPath';

const files = new Set([
  'src/a.ts',
  'src/util/index.ts',
  'src/util/strings.ts',
  'lib/x.js',
  'include/foo.h',
]);

describe('resolveImportPath', () => {
  it('resolves relative specifiers with extension probing', () => {
    expect(resolveImportPath('src/a.ts', './util/strings', files)).toBe('src/util/strings.ts');
    expect(resolveImportPath('src/util/strings.ts', '../a', files)).toBe('src/a.ts');
  });

  it('resolves directories to their index file', () => {
    expect(resolveImportPath('src/a.ts', './util', files)).toBe('src/util/index.ts');
  });

  it('maps .js specifiers to ts sources', () => {
    expect(resolveImportPath('src/a.ts', './util/strings.js', files)).toBe('src/util/strings.ts');
  });

  it('resolves repo-root paths and exact files', () => {
    expect(resolveImportPath('src/a.ts', 'include/foo.h', files)).toBe('include/foo.h');
    expect(resolveImportPath('src/a.ts', 'foo.h', new Set(['src/foo.h']))).toBe('src/foo.h');
  });

  it('ignores packages, urls and paths escaping the repo', () => {
    expect(resolveImportPath('src/a.ts', 'react', files)).toBeNull();
    expect(resolveImportPath('src/a.ts', 'https://x.y/z.js', files)).toBeNull();
    expect(resolveImportPath('a.ts', '../../x', files)).toBeNull();
  });
});
