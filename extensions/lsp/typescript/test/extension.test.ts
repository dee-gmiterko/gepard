import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../dist/index.js';
import type { LanguageSession } from '../types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const sink = { status: () => {}, log: () => {} };

describe('typescript extension', () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable compiler and opens a working session', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-'));

    const session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
    try {
      expect((await readdir(dataDir)).length).toBeGreaterThan(0);
    } finally {
      await session.dispose();
    }
  });

  it('identifies its files', () => {
    expect(extension.matches('src/a.ts')).toBe(true);
    expect(extension.matches('src/a.tsx')).toBe(true);
    expect(extension.matches('src/a.jsx')).toBe(true);
    expect(extension.matches('src/a.py')).toBe(false);
    expect(extension.languageId('a.ts')).toBe('typescript');
    expect(extension.languageId('a.tsx')).toBe('typescriptreact');
    expect(extension.languageId('a.jsx')).toBe('javascriptreact');
    expect(extension.languageId('a.mjs')).toBe('javascript');
    expect(extension.warmupFile(['types.d.ts', 'a.ts'])).toBe('a.ts');
  });
});

describe('language server on fixtures', () => {
  let dataDir: string;
  let session: LanguageSession;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-'));
    session = await extension.open({ root: FIXTURES }, { dataDir }, sink);
  }, 30_000);

  afterAll(async () => {
    await session?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('parses a TypeScript module and reports its top-level symbols', async () => {
    const symbols = await session.documentSymbols('module.ts');
    expect(symbols.map((s) => s.name)).toEqual([
      'Store',
      'Color',
      'Id',
      'VERSION',
      'makeStore',
      'Util',
    ]);
    expect(symbols.find((s) => s.name === 'Store')?.kind).toBe('class');
  });

  it('parses a TSX component and reports its top-level symbols', async () => {
    const symbols = await session.documentSymbols('component.tsx');
    expect(symbols.map((s) => s.name)).toEqual([
      'useState',
      'Store',
      'ButtonProps',
      'Button',
      'Counter',
      'App',
    ]);
    expect(symbols.find((s) => s.name === 'ButtonProps')?.kind).toBe('interface');
  });

  it('parses a JSX widget and reports its top-level symbol', async () => {
    const symbols = await session.documentSymbols('widget.jsx');
    expect(symbols.map((s) => s.name)).toEqual(['Widget']);
  });
});
