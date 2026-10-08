import { describe, expect, it } from 'vitest';
import { toRepoLocation } from '@gepard/common-lsp';

describe('toRepoLocation', () => {
  const root = '/work/repo';

  it('maps a file inside the root to a repo-relative path', () => {
    expect(toRepoLocation(root, 'file:///work/repo/src/a.txt')).toEqual({
      path: 'src/a.txt',
      external: false,
    });
  });

  it('marks a file outside the root as external', () => {
    expect(toRepoLocation(root, 'file:///opt/lib/b.txt')).toEqual({
      path: 'opt/lib/b.txt',
      external: true,
    });
  });

  it('does not treat a sibling directory sharing the root prefix as inside', () => {
    expect(toRepoLocation(root, 'file:///work/repo-other/c.txt').external).toBe(true);
  });

  it.each([
    'csharp:/metadata/projects/App/assemblies/System.Runtime/symbols/System.String.cs',
    'jdt://contents/rt.jar/java.lang/String.class?=proj/%5C/usr%5C/lib%5C/jvm%5C/rt.jar%3Cjava.lang(String.class',
    'zipfile:///home/u/.yarn/cache/typescript-npm-5.4.0.zip/node_modules/typescript/lib/lib.d.ts',
  ])('returns the non-file uri %s as external instead of throwing', (uri) => {
    expect(toRepoLocation(root, uri)).toEqual({ path: uri, external: true });
  });
});
