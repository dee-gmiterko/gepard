import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExtensionInfo } from '@gepard/common';
import { dedupeBroken, findPackageRoot } from '../../helpers/extension';
import { makeTmpDir } from '../support/tmp';

describe('findPackageRoot', () => {
  it('accepts a package.json at the root or in a single top-level directory', async () => {
    const tmp = await makeTmpDir('pkg-root');
    try {
      await mkdir(join(tmp.path, 'nested', 'pkg'), { recursive: true });
      await writeFile(join(tmp.path, 'nested', 'pkg', 'package.json'), '{}');
      expect(await findPackageRoot(join(tmp.path, 'nested'))).toBe(join(tmp.path, 'nested', 'pkg'));
      await writeFile(join(tmp.path, 'nested', 'package.json'), '{}');
      expect(await findPackageRoot(join(tmp.path, 'nested'))).toBe(join(tmp.path, 'nested'));
      await mkdir(join(tmp.path, 'empty'));
      await expect(findPackageRoot(join(tmp.path, 'empty'))).rejects.toMatchObject({
        code: 'EXTENSION_INVALID_ARCHIVE',
      });
    } finally {
      await tmp.cleanup();
    }
  });
});

describe('dedupeBroken', () => {
  it('keeps one entry per broken package and every healthy one', () => {
    const ok = (id: string): ExtensionInfo => ({
      id,
      displayName: id,
      kind: 'lsp',
      source: { kind: 'local' },
      enabled: true,
    });
    const broken = (kind: ExtensionInfo['kind']): ExtensionInfo => ({
      ...ok('/ext/bad'),
      kind,
      enabled: false,
      error: 'boom',
    });
    const list = dedupeBroken([ok('a'), broken('lsp'), broken('theme'), ok('b'), broken('locale')]);
    expect(list.map((e) => e.id)).toEqual(['a', '/ext/bad', 'b']);
  });
});
