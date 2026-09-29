import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../dist/index.js';
import type { LanguageSession } from '../types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('gdscript extension', () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('starts a headless editor and opens a working session', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'gd-ext-'));

    const session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
    try {
      expect((await readdir(dataDir)).length).toBeGreaterThan(0);
    } finally {
      await session.dispose();
    }
  }, 120_000);

  it('identifies its files', () => {
    expect(extension.matches('src/a.gd')).toBe(true);
    expect(extension.matches('src/a.tscn')).toBe(false);
    expect(extension.matches('src/a.ts')).toBe(false);
    expect(extension.languageId('a.gd')).toBe('gdscript');
    expect(extension.warmupFile(['a.tscn', 'a.gd'])).toBe('a.gd');
  });
});

describe('language server on fixtures', () => {
  let dataDir: string;
  let session: LanguageSession;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'gd-ext-'));
    session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
  }, 120_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('parses a class and reports its members', async () => {
    const symbols = await session.documentSymbols('store.gd');
    expect(symbols.map((s) => ({ name: s.name, kind: s.kind }))).toEqual([
      { name: 'changed', kind: 'property' },
      { name: 'VERSION', kind: 'constant' },
      { name: 'items', kind: 'variable' },
      { name: 'add', kind: 'method' },
      { name: 'count', kind: 'method' },
    ]);
  });

  it('resolves a definition across files', async () => {
    const [target] = await session.definition('repository.gd', { line: 4, col: 13 });
    expect(target.external).toBe(false);
    expect(target.location.path).toBe('store.gd');
    expect(target.location.range.start.line).toBe(1);
  });

  it('finds references across files', async () => {
    const files = await session.references('store.gd', { line: 1, col: 12 });
    expect(files.map((f) => f.path)).toEqual(['repository.gd', 'store.gd']);
  });

  it('lists workspace symbols from every script', async () => {
    const symbols = await session.workspaceSymbols('store', 50);
    expect(symbols.map((s) => `${s.location.path}:${s.name}`)).toEqual([
      'repository.gd:store',
      'repository.gd:make_store',
    ]);
  });

  it('reports resolvable identifiers on a line', async () => {
    const symbols = await session.lineSymbols('repository.gd', 4);
    expect(symbols.map((s) => `${s.name}:${s.kind}`)).toEqual([
      'store:variable',
      'Store:class',
      'Store:class',
    ]);
    expect(symbols[0].modifiers).toEqual(['declaration']);
  });
});
