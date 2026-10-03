import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';
import { makeTmpDir, type TmpDir } from './support/tmp';

const schema = z.object({ n: z.number() });
let tmp: TmpDir;

beforeEach(async () => {
  tmp = await makeTmpDir('jsonfile');
});
afterEach(async () => {
  await tmp.cleanup();
});

describe('writeJsonFile', () => {
  it('creates parent directories, writes formatted JSON and leaves no temp files', async () => {
    const file = join(tmp.path, 'sub', 'data.json');
    await writeJsonFile(file, { n: 1 });
    expect(await readFile(file, 'utf8')).toBe('{\n  "n": 1\n}\n');
    expect(await readdir(join(tmp.path, 'sub'))).toEqual(['data.json']);
  });
});

describe('readJsonFile', () => {
  it('returns parsed data written by writeJsonFile', async () => {
    const file = join(tmp.path, 'data.json');
    await writeJsonFile(file, { n: 2 });
    expect(await readJsonFile(file, schema, () => ({ n: 0 }))).toEqual({ n: 2 });
  });

  it('uses the fallback when the file is missing', async () => {
    expect(await readJsonFile(join(tmp.path, 'none.json'), schema, () => 'fallback')).toBe(
      'fallback',
    );
  });

  it('throws STORE_CORRUPT for invalid JSON or schema mismatch', async () => {
    const file = join(tmp.path, 'bad.json');
    await writeFile(file, '{oops', 'utf8');
    await expect(readJsonFile(file, schema, () => null)).rejects.toMatchObject({
      code: 'STORE_CORRUPT',
    });
    await writeFile(file, '{"n":"x"}', 'utf8');
    await expect(readJsonFile(file, schema, () => null)).rejects.toMatchObject({
      code: 'STORE_CORRUPT',
    });
  });
});
