import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import extension from '../index';
import type { LanguageSession } from '@gepard/common';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
const sink = { status: () => {}, log: () => {} };

describe('cpp extension', () => {
  it('installs clangd and opens a working session', async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const session = await extension.open({ root: FIXTURES }, { dataDir: DATA_DIR }, sink);
    try {
      expect(await readdir(join(DATA_DIR, 'clangd'))).not.toHaveLength(0);
      expect(await readdir(join(DATA_DIR, 'compdb'))).not.toHaveLength(0);
    } finally {
      await session.dispose();
    }
  }, 60_000);
});

describe('language server on fixtures', () => {
  let session: LanguageSession;

  beforeAll(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    session = await extension.open({ root: FIXTURES }, { dataDir: DATA_DIR }, sink);
  }, 60_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(join(DATA_DIR, 'compdb'), { recursive: true, force: true });
  });

  it('parses a header and reports the class members', async () => {
    const symbols = await session.documentSymbols('store.h');
    expect(symbols.map((s) => s.name)).toEqual(['shop']);
    const store = symbols[0].children[0];
    expect(store.name).toBe('Store');
    expect(store.kind).toBe('class');
    expect(store.children.map((c) => c.name).sort()).toEqual(['add', 'count', 'items_']);
  });

  it('resolves a definition across files', async () => {
    const defs = await session.definition('main.cpp', { line: 5, col: 9 });
    expect(defs.map((d) => d.location.path)).toEqual(['store.cpp']);
    expect(defs[0].external).toBe(false);
  });

  it('reports line symbols from semantic tokens', async () => {
    const symbols = await session.lineSymbols('main.cpp', 4);
    expect(symbols.map((s) => s.name)).toContain('Store');
  });
});
