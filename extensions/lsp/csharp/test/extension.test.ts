import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../dist/index.js';
import type { LanguageSession } from '../types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('csharp extension', () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable language server and opens a working session', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'cs-ext-'));

    const session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
    try {
      expect((await readdir(dataDir)).length).toBeGreaterThan(0);
    } finally {
      await session.dispose();
    }
  }, 30_000);

  it('identifies its files', () => {
    expect(extension.matches('src/a.cs')).toBe(true);
    expect(extension.matches('src/a.ts')).toBe(false);
    expect(extension.languageId('a.cs')).toBe('csharp');
    expect(extension.warmupFile(['README.md', 'a.cs'])).toBe('a.cs');
  });
});

describe('language server on fixtures', () => {
  let dataDir: string;
  let session: LanguageSession;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'cs-ext-'));
    session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
  }, 30_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('parses a class and reports its members', async () => {
    const symbols = await session.documentSymbols('Store.cs');
    expect(symbols.map((s) => s.name)).toEqual(['Store']);
    expect(symbols[0].kind).toBe('class');
    expect(symbols[0].children.map((c) => c.name).sort()).toEqual(['Add', 'Items']);
  });

  it('parses an interface and reports its members', async () => {
    const symbols = await session.documentSymbols('IRepository.cs');
    expect(symbols.map((s) => s.name)).toEqual(['IRepository']);
    expect(symbols[0].kind).toBe('interface');
    expect(symbols[0].children.map((c) => c.name)).toEqual(['Load']);
  });
});
