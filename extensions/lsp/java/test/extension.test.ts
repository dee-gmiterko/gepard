import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../index';
import type { LanguageSession } from '@gepard/common';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('java extension', () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable language server and opens a working session', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'java-ext-'));

    const session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
    try {
      expect((await readdir(dataDir)).length).toBeGreaterThan(0);
    } finally {
      await session.dispose();
    }
  }, 60_000);
});

describe('language server on fixtures', () => {
  let dataDir: string;
  let session: LanguageSession;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'java-ext-'));
    session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
  }, 60_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('parses a class and reports its members', async () => {
    const symbols = await session.documentSymbols('Store.java');
    const cls = symbols.find((s) => s.name === 'Store');
    expect(cls?.kind).toBe('class');
    expect(cls?.children.map((c) => c.name).sort()).toEqual(['add(String)', 'items']);
  });

  it('parses an interface and reports its members', async () => {
    const symbols = await session.documentSymbols('Repository.java');
    const iface = symbols.find((s) => s.name === 'Repository');
    expect(iface?.kind).toBe('interface');
    expect(iface?.children.map((c) => c.name)).toEqual(['load()']);
  });

  it('resolves a project symbol to an in-project definition', async () => {
    const defs = await session.definition('Store.java', { line: 10, col: 20 });
    expect(defs.map((d) => [d.location.path, d.external])).toContainEqual(['Store.java', false]);
  });

  it('reports line symbols from semantic tokens', async () => {
    const symbols = await session.lineSymbols('Store.java', 9);
    expect(symbols.map((s) => s.name)).toContain('add');
  });

  it('finds references to a project symbol', async () => {
    const refs = await session.references('Store.java', { line: 7, col: 33 });
    expect(refs.some((r) => r.path === 'Store.java')).toBe(true);
  }, 60_000);
});
