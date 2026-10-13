import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import extension from '../index';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('gdscript extension without `godot` on PATH', () => {
  let dataDir: string;
  let originalPath: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'gdscript-ext-'));
    originalPath = process.env.PATH ?? '';
    process.env.PATH = dataDir;
  });

  afterEach(async () => {
    process.env.PATH = originalPath;
    await rm(dataDir, { recursive: true, force: true });
  });

  it('fails to open with a MissingDependencyError naming godot', async () => {
    await expect(extension.open({ root: FIXTURES }, { dataDir }, sink)).rejects.toMatchObject({
      name: 'MissingDependencyError',
      code: 'MISSING_DEPENDENCY',
      dependency: 'godot',
    });
  });
});
