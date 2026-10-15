import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from '../../helpers/extension';
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
