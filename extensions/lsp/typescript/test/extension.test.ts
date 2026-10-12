import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import extension from '../index';
import type { LanguageSession, SourceDefinition } from '@gepard/common';

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
  }, 30_000);
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

  it('parses a plain JavaScript module and reports its top-level symbols', async () => {
    const symbols = await session.documentSymbols('plain.js');
    expect(symbols.map((s) => s.name)).toEqual(['Cache', 'LIMIT', 'makeCache']);
    expect(symbols.find((s) => s.name === 'Cache')?.kind).toBe('class');
    expect(symbols.find((s) => s.name === 'Cache')?.children.map((c) => c.name)).toEqual([
      'constructor',
      'get',
    ]);
  });
  describe('imports', () => {
    const FILE = 'imports.ts';
    const TARGET = 'imports-target.ts';

    const definitionAt = (line: number, col: number): Promise<SourceDefinition[]> =>
      vi.waitFor(
        async () => {
          const found = await session.definition(FILE, { line, col });
          expect(found.length).toBeGreaterThan(0);
          return found;
        },
        { timeout: 15_000, interval: 250 },
      );

    it('resolves a named import to the exported declaration', async () => {
      const defs = await definitionAt(1, 10);
      expect(defs[0].location.path).toBe(TARGET);
      expect(defs[0].location.range.start).toEqual({ line: 1, col: 14 });
    });

    it('resolves a default import to the default export', async () => {
      const defs = await definitionAt(2, 8);
      expect(defs[0].location.path).toBe(TARGET);
      expect(defs[0].location.range.start).toEqual({ line: 2, col: 25 });
    });

    it('resolves a namespace import to the module file', async () => {
      const defs = await definitionAt(3, 13);
      expect(defs[0].location.path).toBe(TARGET);
      expect(defs[0].location.range.start).toEqual({ line: 1, col: 1 });
    });

    it('resolves a type-only import to the exported interface', async () => {
      const defs = await definitionAt(4, 15);
      expect(defs[0].location.path).toBe(TARGET);
      expect(defs[0].location.range.start).toEqual({ line: 3, col: 18 });
    });

    it('resolves import path specifiers to the module file', async () => {
      for (const [line, col, path] of [
        [1, 21, TARGET],
        [2, 18, TARGET],
        [3, 21, TARGET],
        [4, 24, TARGET],
        [5, 8, 'module.ts'],
        [7, 27, TARGET],
      ] as const) {
        const defs = await definitionAt(line, col);
        expect(defs[0].location.path).toBe(path);
        expect(defs[0].location.range.start).toEqual({ line: 1, col: 1 });
      }
    });

    it('reports named, default, namespace and type-only imports as imports in the document symbols', async () => {
      const symbols = await session.documentSymbols(FILE);
      for (const name of ['foo', 'main', 'ns', 'T']) {
        expect(symbols.find((s) => s.name === name)?.kind, name).toBe('import');
      }
      expect(symbols.find((s) => s.name === 'lazyModule')?.kind).not.toBe('import');
    });

    it('reports imported names as imports in the line symbols', async () => {
      const expected: [number, string][] = [
        [1, 'foo'],
        [2, 'main'],
        [3, 'ns'],
        [4, 'T'],
      ];
      for (const [line, name] of expected) {
        const symbols = await session.lineSymbols(FILE, line);
        expect(symbols.find((s) => s.name === name)?.kind, `line ${line}`).toBe('import');
      }
    });

    it('reports import path specifiers as imports in the line symbols', async () => {
      for (const line of [1, 2, 3, 4, 5, 7]) {
        const symbols = await session.lineSymbols(FILE, line);
        const specifier = symbols.find(
          (s) => s.name.includes('imports-target') || s.name.includes('module'),
        );
        expect(specifier?.kind, `line ${line}`).toBe('import');
      }
    });

    it('reports usages of imported names with the kind of the imported declaration', async () => {
      const symbols = await session.lineSymbols(FILE, 9);
      expect(symbols.find((s) => s.name === 'main')?.kind).toBe('function');
      expect(symbols.find((s) => s.name === 'foo')?.kind).toBe('constant');
    });
  });
});
