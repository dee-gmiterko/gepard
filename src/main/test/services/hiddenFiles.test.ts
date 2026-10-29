import { describe, expect, it } from 'vitest';
import { HiddenFilesService } from '../../services/hiddenFiles';
import { FilesHandlers } from '../../ipc/handlers/files';
import type { GitService } from '../../services/git';

function service(globalPatterns: string[], projectPatterns: string[]): HiddenFilesService {
  return new HiddenFilesService(
    { getHiddenFiles: () => Promise.resolve(globalPatterns) },
    { getHiddenFiles: () => Promise.resolve(projectPatterns) },
  );
}

describe('HiddenFilesService', () => {
  const paths = ['a.ts', 'b.lock', 'dist/c.js'];

  it('applies global and project patterns together', async () => {
    const result = await service(['\\.lock$'], ['^dist/']).filter('p', paths, (p) => p);
    expect(result).toEqual(['a.ts']);
  });

  it('ignores an invalid pattern and still applies the valid ones', async () => {
    const result = await service(['('], ['\\.lock$']).filter('p', paths, (p) => p);
    expect(result).toEqual(['a.ts', 'dist/c.js']);
  });
});

describe('FilesHandlers hidden files', () => {
  const git = {
    listTree: () => Promise.resolve(['a.ts', 'b.lock']),
    changedFiles: () =>
      Promise.resolve([
        { path: 'a.ts', previousPath: null, changeType: 'modified', additions: 1, deletions: 0 },
        { path: 'b.lock', previousPath: null, changeType: 'modified', additions: 1, deletions: 0 },
      ]),
  } as unknown as GitService;
  const handlers = new FilesHandlers(git, service(['\\.lock$'], [])).toHandlerMap();
  const ctx = { window: null };

  it('never returns hidden paths from the tree', async () => {
    expect(await handlers['trees.get']({ projectId: 'p', sha: 's' }, ctx)).toEqual(['a.ts']);
  });

  it('never returns hidden changed files', async () => {
    const files = await handlers['files.changed']({ projectId: 'p', base: 'a', head: 'b' }, ctx);
    expect(files.map((f) => f.path)).toEqual(['a.ts']);
  });
});
