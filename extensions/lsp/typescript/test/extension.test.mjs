import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import extension from '../index.mjs';
import { LspClient } from './support/lsp-client.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const KIND = {
  3: 'namespace',
  5: 'class',
  6: 'method',
  7: 'property',
  10: 'enum',
  11: 'interface',
  12: 'function',
  13: 'variable',
  22: 'enumMember',
};

function outline(symbols, depth = 0) {
  return symbols.flatMap((s) => [
    `${'  '.repeat(depth)}${KIND[s.kind] ?? s.kind} ${s.name}`,
    ...outline(s.children ?? [], depth + 1),
  ]);
}

function find(symbols, name) {
  for (const s of symbols) {
    if (s.name === name) return s;
    const nested = find(s.children ?? [], name);
    if (nested) return nested;
  }
  return undefined;
}

function span(startLine, startChar, endLine, endChar) {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

describe('typescript extension', () => {
  let dataDir;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('materializes a runnable native compiler next to its library files', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-'));

    const plan = await extension.resolve({ root: '/repo' }, { dataDir });

    await access(join(dirname(plan.command), 'lib.d.ts'));
    const { stdout } = await promisify(execFile)(plan.command, ['--version']);
    expect(stdout).toMatch(/\d+\.\d+/);
    expect(plan.args).toEqual(['--lsp', '--stdio']);
    expect(plan.cwd).toBe('/repo');
  });

  it('reuses the materialized compiler on later resolves', async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-'));

    const first = await extension.resolve({ root: '/repo' }, { dataDir });
    const second = await extension.resolve({ root: '/repo' }, { dataDir });

    expect(second.command).toBe(first.command);
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
  let dataDir;
  let client;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ts-ext-'));
    const plan = await extension.resolve({ root: FIXTURES }, { dataDir });
    client = await LspClient.start(plan, extension.languageId);
  }, 30_000);

  afterAll(async () => {
    await client?.dispose();
    await rm(dataDir, { recursive: true, force: true });
  });

  function documentSymbols(file) {
    return client.withDocument(file, (uri) =>
      client.request('textDocument/documentSymbol', { textDocument: { uri } }),
    );
  }

  it('extracts the outline of a TypeScript module', async () => {
    const symbols = await documentSymbols('module.ts');

    expect(outline(symbols)).toEqual([
      'class Store',
      '  property items',
      '  method add',
      'enum Color',
      '  enumMember Red',
      '  enumMember Green',
      // The server reports type aliases with the class kind, as tsserver does.
      'class Id',
      'variable VERSION',
      'function makeStore',
      'namespace Util',
      '  variable noop',
    ]);
    expect(find(symbols, 'Store')).toMatchObject({
      range: span(0, 0, 6, 1),
      selectionRange: span(0, 13, 0, 18),
    });
    expect(find(symbols, 'add')).toMatchObject({
      range: span(3, 2, 5, 3),
      selectionRange: span(3, 2, 3, 5),
    });
  });

  it('extracts components and their hooks from a TSX file', async () => {
    const symbols = await documentSymbols('component.tsx');

    expect(outline(symbols)).toEqual([
      'variable useState',
      'variable Store',
      'interface ButtonProps',
      '  property label',
      '  method onClick',
      'function Button',
      'variable Counter',
      '  variable count',
      '  variable setCount',
      '  variable increment',
      '    function setCount() callback',
      'class App',
      '  property store',
      '  method render',
    ]);
    expect(find(symbols, 'Button')).toMatchObject({
      range: span(8, 0, 10, 1),
      selectionRange: span(8, 16, 8, 22),
    });
    expect(find(symbols, 'Counter')).toMatchObject({
      range: span(12, 13, 20, 1),
      selectionRange: span(12, 13, 12, 20),
    });
    expect(find(symbols, 'render')).toMatchObject({ selectionRange: span(25, 2, 25, 8) });
  });

  it('extracts a component from a JSX file', async () => {
    const symbols = await documentSymbols('widget.jsx');

    expect(outline(symbols)).toEqual(['function Widget']);
    expect(symbols[0]).toMatchObject({
      range: span(0, 0, 2, 1),
      selectionRange: span(0, 16, 0, 22),
    });
  });

  it('resolves a JSX tag and an imported class to their definitions', async () => {
    const definitionAt = (uri, line, character) =>
      client.request('textDocument/definition', {
        textDocument: { uri },
        position: { line, character },
      });

    const [tag, imported] = await client.withDocument('component.tsx', async (uri) => [
      await definitionAt(uri, 17, 8),
      await definitionAt(uri, 23, 24),
    ]);

    expect(tag).toEqual([{ uri: client.uri('component.tsx'), range: span(8, 16, 8, 22) }]);
    expect(imported).toEqual([{ uri: client.uri('module.ts'), range: span(0, 13, 0, 18) }]);
  });

  it('finds references to a component including its JSX usage', async () => {
    const references = await client.withDocument('component.tsx', (uri) =>
      client.request('textDocument/references', {
        textDocument: { uri },
        position: { line: 8, character: 17 },
        context: { includeDeclaration: true },
      }),
    );

    expect(references).toEqual([
      { uri: client.uri('component.tsx'), range: span(8, 16, 8, 22) },
      { uri: client.uri('component.tsx'), range: span(17, 7, 17, 13) },
    ]);
  });

  it('finds workspace symbols in files that are not open', async () => {
    const [store, counter] = await client.withDocument('module.ts', async () => [
      await client.request('workspace/symbol', { query: 'Store' }),
      await client.request('workspace/symbol', { query: 'Counter' }),
    ]);

    expect(store).toContainEqual({
      name: 'Store',
      kind: 5,
      location: { uri: client.uri('module.ts'), range: span(0, 13, 0, 18) },
    });
    expect(counter).toContainEqual({
      name: 'Counter',
      kind: 13,
      location: { uri: client.uri('component.tsx'), range: span(12, 13, 12, 20) },
    });
  });

  it('classifies the identifiers on a component signature line', async () => {
    const line = 8;
    const tokens = await client.withDocument('component.tsx', async (uri, text) => {
      const lineText = text.split('\n')[line];
      const { data } = await client.request('textDocument/semanticTokens/range', {
        textDocument: { uri },
        range: span(line, 0, line, lineText.length),
      });
      return client.decodeTokens(data).map((t) => ({
        text: lineText.slice(t.character, t.character + t.length),
        type: t.type,
        modifiers: t.modifiers,
      }));
    });

    expect(tokens).toEqual([
      { text: 'Button', type: 'function', modifiers: ['declaration'] },
      { text: 'label', type: 'parameter', modifiers: ['declaration'] },
      { text: 'onClick', type: 'function', modifiers: ['declaration'] },
      { text: 'ButtonProps', type: 'interface', modifiers: [] },
    ]);
  });
});
