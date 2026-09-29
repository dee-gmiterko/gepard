import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../dist/index.js';
import type { LanguageSession } from '../types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('python extension', () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable language server and opens a working session', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'py-ext-'));

    const session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
    try {
      expect((await readdir(dataDir)).length).toBeGreaterThan(0);
    } finally {
      await session.dispose();
    }
  });

  it('identifies its files', () => {
    expect(extension.matches('src/a.py')).toBe(true);
    expect(extension.matches('src/a.pyi')).toBe(true);
    expect(extension.matches('src/a.ts')).toBe(false);
    expect(extension.languageId('a.py')).toBe('python');
    expect(extension.warmupFile(['a.pyi', 'a.py'])).toBe('a.py');
  });
});

describe('language server on fixtures', () => {
  let dataDir: string;
  let session: LanguageSession;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'py-ext-'));
    session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
  }, 30_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('parses a class and reports its methods and fields', async () => {
    const symbols = await session.documentSymbols('store.py');
    expect(symbols.map((s) => s.name)).toEqual(['Store']);
    expect(symbols[0].kind).toBe('class');
    expect(symbols[0].children.map((c) => c.name)).toEqual(['__init__', 'add', 'items']);
  });

  it('parses module-level functions and constants', async () => {
    const symbols = await session.documentSymbols('util.py');
    expect(symbols.map((s) => ({ name: s.name, kind: s.kind }))).toEqual([
      { name: 'VERSION', kind: 'constant' },
      { name: 'make_store', kind: 'function' },
    ]);
  });
});
