import { describe, expect, it } from 'vitest';
import type { ImportResolution } from '../../extensions/lsp';
import { resolveImportSpecifier } from '../../extensions/importResolution';

const rules: ImportResolution = {
  extensions: ['.ts', '.tsx', '.js', '.d.ts'],
  indexFiles: ['index.ts', 'index.js'],
  emittedExtensions: ['.js', '.mjs'],
};

const files = new Set([
  'src/a.ts',
  'src/util/index.ts',
  'src/util/strings.ts',
  'lib/x.js',
  'include/foo.h',
]);
const isFile = (path: string): Promise<boolean> => Promise.resolve(files.has(path));
const resolve = (from: string, spec: string, r = rules): Promise<string | null> =>
  resolveImportSpecifier(from, spec, r, isFile);

describe('resolveImportSpecifier', () => {
  it('resolves relative specifiers with extension probing', async () => {
    await expect(resolve('src/a.ts', './util/strings')).resolves.toBe('src/util/strings.ts');
    await expect(resolve('src/util/strings.ts', '../a')).resolves.toBe('src/a.ts');
  });

  it('resolves directories to their index file', async () => {
    await expect(resolve('src/a.ts', './util')).resolves.toBe('src/util/index.ts');
  });

  it('maps emitted extensions to source files', async () => {
    await expect(resolve('src/a.ts', './util/strings.js')).resolves.toBe('src/util/strings.ts');
  });

  it('does not map emitted extensions the language does not declare', async () => {
    await expect(
      resolve('src/a.ts', './util/strings.js', { ...rules, emittedExtensions: [] }),
    ).resolves.toBeNull();
  });

  it('resolves repo-root paths and exact files', async () => {
    await expect(resolve('src/a.ts', 'include/foo.h')).resolves.toBe('include/foo.h');
  });

  it('ignores bare packages, urls and paths escaping the root', async () => {
    await expect(resolve('src/a.ts', 'react')).resolves.toBeNull();
    await expect(resolve('src/a.ts', 'https://x.y/z.js')).resolves.toBeNull();
    await expect(resolve('a.ts', '../../x')).resolves.toBeNull();
  });
});
