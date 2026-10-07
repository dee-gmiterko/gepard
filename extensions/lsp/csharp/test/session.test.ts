import { describe, expect, it } from 'vitest';
import { RoslynSession } from '../session';

describe('RoslynSession toRepoLocation', () => {
  const root = '/work/repo';
  // The method only reads the root, so the session is built without launching a server.
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  const session: {
    toRepoLocation(uri: string): { path: string; external: boolean };
  } = Object.assign(Object.create(RoslynSession.prototype), { spec: { root } });

  it('maps a file inside the root to a repo-relative path', () => {
    expect(session.toRepoLocation('file:///work/repo/src/a.txt')).toEqual({
      path: 'src/a.txt',
      external: false,
    });
  });

  it('marks a file outside the root as external', () => {
    expect(session.toRepoLocation('file:///opt/lib/b.txt')).toEqual({
      path: 'opt/lib/b.txt',
      external: true,
    });
  });

  it('does not treat a sibling directory sharing the root prefix as inside', () => {
    expect(session.toRepoLocation('file:///work/repo-other/c.txt').external).toBe(true);
  });

  it('returns a non-file definition uri as external instead of throwing', () => {
    expect(
      session.toRepoLocation(
        'csharp:/metadata/projects/App/assemblies/System.Runtime/symbols/System.String.cs',
      ).external,
    ).toBe(true);
  });
});
