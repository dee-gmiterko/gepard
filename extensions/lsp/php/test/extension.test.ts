import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import extension from '../index';
import type { LanguageSession } from '@gepard/common';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
const sink = { status: () => {}, log: () => {} };

describe('php extension', () => {
  it('installs phpantom and opens a working session', async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const session = await extension.open(
      { root: join(FIXTURES, 'composer') },
      { dataDir: DATA_DIR },
      sink,
    );
    try {
      expect(await readdir(join(DATA_DIR, 'phpantom'))).not.toHaveLength(0);
      expect(await readdir(join(DATA_DIR, 'home'))).not.toHaveLength(0);
    } finally {
      await session.dispose();
    }
  }, 60_000);

  it('picks a warm-up file outside vendor', () => {
    expect(extension.warmupFile(['vendor/a/b.php', 'src/App.php', 'x.txt'])).toBe('src/App.php');
  });
});

describe('language server on a composer project', () => {
  let session: LanguageSession;

  beforeAll(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    session = await extension.open(
      { root: join(FIXTURES, 'composer') },
      { dataDir: DATA_DIR },
      sink,
    );
  }, 60_000);

  afterAll(async () => {
    await session?.dispose();
  });

  it('reports the class members', async () => {
    const symbols = await session.documentSymbols('src/Store.php');
    expect(symbols.map((s) => s.name)).toEqual(['Store']);
    expect(symbols[0].kind).toBe('class');
    expect(symbols[0].children.map((c) => c.name).sort()).toEqual(['$items', 'add', 'count']);
  });

  it('resolves a definition across files', async () => {
    const defs = await session.definition('main.php', { line: 6, col: 10 });
    expect(defs.map((d) => d.location.path)).toEqual(['src/Store.php']);
    expect(defs[0].external).toBe(false);
  });

  it('reports line symbols from semantic tokens', async () => {
    const symbols = await session.lineSymbols('main.php', 5);
    expect(symbols.map((s) => s.name)).toContain('Store');
  });

  it('finds workspace symbols', async () => {
    const symbols = await session.workspaceSymbols('Store', 10);
    expect(symbols.map((s) => s.name)).toContain('Shop\\Store');
  });
});

describe('language server on a project without composer', () => {
  let session: LanguageSession;

  beforeAll(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    session = await extension.open({ root: join(FIXTURES, 'plain') }, { dataDir: DATA_DIR }, sink);
  }, 60_000);

  afterAll(async () => {
    await session?.dispose();
  });

  it('resolves a definition across files', async () => {
    const defs = await session.definition('main.php', { line: 6, col: 10 });
    expect(defs.map((d) => d.location.path)).toEqual(['store.php']);
  });
});
