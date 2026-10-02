import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { isGrammarExtension } from '@gepard/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');

describe('built bundle', () => {
  let isolatedDir: string;

  beforeAll(async () => {
    isolatedDir = await mkdtemp(join(tmpdir(), 'bundle-'));
  });

  afterAll(async () => {
    await rm(isolatedDir, { recursive: true, force: true });
  });

  it('exports a valid grammar extension', async () => {
    const loaded: unknown = await import(pathToFileURL(DIST).href);
    const extension =
      loaded && typeof loaded === 'object' && 'default' in loaded ? loaded.default : undefined;
    expect(isGrammarExtension(extension)).toBe(true);
  });

  it('loads in isolation without any installed packages', async () => {
    const copy = join(isolatedDir, 'index.mjs');
    await copyFile(DIST, copy);
    const script = `await import(${JSON.stringify(pathToFileURL(copy).href)})`;
    await expect(
      run(process.execPath, ['--input-type=module', '-e', script], { cwd: isolatedDir }),
    ).resolves.toBeDefined();
  });
});
