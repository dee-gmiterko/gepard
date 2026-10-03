import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GroupedResult,
  SearchQuery,
  type LanguageSession,
  type WorkspaceSymbol,
} from '@gepard/common';
import { __setUserDataDir } from './support/electron';
import { fakeLanguageSession } from './support/session';
import { makeTmpDir, type TmpDir } from './support/tmp';

const mocks = vi.hoisted(
  (): {
    currentSha: string | null;
    lineIndex: unknown;
    session: unknown;
    sessions: LanguageSession[];
  } => ({
    currentSha: null,
    lineIndex: null,
    session: null,
    sessions: [],
  }),
);

vi.mock('../lsp', () => ({
  indexer: {
    currentSha: () => mocks.currentSha,
    sessions: () => mocks.sessions,
    session: () => mocks.session,
    lineIndex: () => mocks.lineIndex,
  },
}));

const { runSearch, workspaceSymbols, lineSymbols, definitionAt, documentSymbols } =
  await import('../ipc/handlers/search');

const SHA = 'a'.repeat(40);
const PROJECT = 'owner__repo';

let userData: TmpDir;

async function writeRepoFile(path: string, content: string): Promise<void> {
  const full = join(userData.path, 'projects', PROJECT, 'repo', path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
}

function run(raw: Record<string, unknown>): Promise<GroupedResult> {
  const input = SearchQuery.parse({
    projectId: PROJECT,
    sha: SHA,
    scope: 'all',
    kind: 'pattern',
    text: 'needle',
    ...raw,
  });
  return runSearch(input);
}

const paths = (r: GroupedResult): string[] => r.files.map((f) => f.path);

function hit(
  line: number,
  preview = 'needle',
): {
  line: number;
  preview: string;
  spans: Array<[number, number]>;
} {
  return { line, preview, spans: [[0, 6]] };
}

describe('search.run', () => {
  beforeAll(async () => {
    userData = await makeTmpDir('search-handler');
    __setUserDataDir(userData.path);
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      await writeRepoFile(`src/${name}.ts`, 'needle\nunrelated\nneedle again\n');
    }
    await writeRepoFile('docs/readme.md', 'needle in docs\n');
    await writeRepoFile('many.txt', `${'needle\n'.repeat(700)}`);
    await writeRepoFile('exact.ts', 'const x = 1;\n');
    await writeRepoFile('exact2.ts', '  const x = 1;\nconst x = 10;\n');
    await writeRepoFile('case.txt', 'Needle\nneedle\nNEEDLE\n');
    await writeRepoFile('x.ts', 'export const sym = 1;\n');
  });

  afterAll(async () => {
    await userData.cleanup();
  });

  beforeEach(() => {
    mocks.currentSha = null;
    mocks.lineIndex = null;
    mocks.session = null;
  });

  describe('pattern and regex over ripgrep', () => {
    it('finds a substring and describes a complete result', async () => {
      const result = await run({ text: 'needle', scope: 'targeted', targetedPaths: ['src/a.ts'] });
      expect(paths(result)).toEqual(['src/a.ts']);
      expect(result).toMatchObject({
        query: { kind: 'pattern', text: 'needle', scope: 'targeted' },
        offset: 0,
        nextOffset: null,
        hasMore: false,
        truncated: false,
        matchesInPage: 2,
      });
      expect(result.files[0].moreMatches).toBe(false);
    });

    it('matches a substring of a longer word unless whole-word search is asked for', async () => {
      await writeRepoFile('words.txt', 'needles are needle\n');
      const substring = await run({
        text: 'needle',
        scope: 'targeted',
        targetedPaths: ['words.txt'],
      });
      expect(substring.files[0].matches[0].spans).toEqual([
        [0, 6],
        [12, 18],
      ]);
      const whole = await run({
        text: 'needle',
        word: true,
        scope: 'targeted',
        targetedPaths: ['words.txt'],
      });
      expect(whole.files[0].matches[0].spans).toEqual([[12, 18]]);
    });

    it('ignores case unless case-sensitive search is asked for', async () => {
      const scope = { scope: 'targeted', targetedPaths: ['case.txt'] };
      const lines = (r: GroupedResult): number[] => r.files[0]?.matches.map((m) => m.line) ?? [];

      expect(lines(await run({ ...scope, text: 'needle' }))).toEqual([1, 2, 3]);
      expect(lines(await run({ ...scope, text: 'needle', caseSensitive: true }))).toEqual([2]);
      expect(lines(await run({ ...scope, kind: 'regex', text: 'ne+dle' }))).toEqual([1, 2, 3]);
      expect(
        lines(await run({ ...scope, kind: 'regex', text: 'ne+dle', caseSensitive: true })),
      ).toEqual([2]);
    });

    it('runs a regex', async () => {
      const result = await run({
        kind: 'regex',
        text: 'need[a-z]+ again',
        scope: 'targeted',
        targetedPaths: ['src/b.ts'],
      });
      expect(paths(result)).toEqual(['src/b.ts']);
      expect(result.files[0].matches.map((m) => m.line)).toEqual([3]);
    });

    it('restricts a targeted search to the targeted paths, and ignores them for scope all', async () => {
      const targeted = await run({
        scope: 'targeted',
        targetedPaths: ['docs/readme.md', 'src/c.ts'],
      });
      expect(paths(targeted)).toEqual(['docs/readme.md', 'src/c.ts']);

      const all = await run({ scope: 'all', targetedPaths: ['docs/readme.md'], limit: 200 });
      expect(paths(all).length).toBeGreaterThan(2);
    });

    it('returns an empty, complete page for a targeted search with nothing targeted', async () => {
      expect(await run({ scope: 'targeted', targetedPaths: [] })).toMatchObject({
        files: [],
        hasMore: false,
        nextOffset: null,
        matchesInPage: 0,
      });
    });

    it('reports a regex ripgrep cannot compile as an error', async () => {
      await expect(run({ kind: 'regex', text: '(unclosed' })).rejects.toMatchObject({
        code: 'EXEC_FAILED',
      });
    });
  });

  describe('paging', () => {
    it('walks nextOffset page by page to exactly the un-paged file list', async () => {
      const targetedPaths = ['src', 'docs'];
      const whole = await run({ scope: 'targeted', targetedPaths, limit: 200 });

      const seen: string[] = [];
      let offset: number | null = 0;
      let pages = 0;
      while (offset !== null) {
        const page: GroupedResult = await run({
          scope: 'targeted',
          targetedPaths,
          limit: 2,
          offset,
        });
        expect(page.offset).toBe(offset);
        expect(page.files.length).toBeLessThanOrEqual(2);
        seen.push(...paths(page));
        offset = page.nextOffset;
        pages++;
      }
      expect(seen).toEqual(paths(whole));
      expect(pages).toBe(Math.ceil(seen.length / 2));
    });

    it('caps matches per file by default when paged, and flags the file', async () => {
      const result = await run({
        scope: 'targeted',
        targetedPaths: ['many.txt'],
        limit: 10,
      });
      expect(result.files[0].matches).toHaveLength(50);
      expect(result.files[0].moreMatches).toBe(true);
    });

    it('honours an explicit per-file cap', async () => {
      const result = await run({
        scope: 'targeted',
        targetedPaths: ['many.txt'],
        limit: 10,
        maxMatchesPerFile: 3,
      });
      expect(result.files[0].matches).toHaveLength(3);
    });

    it('returns everything up to a hard cap when no limit is given, and says so', async () => {
      const result = await run({ scope: 'targeted', targetedPaths: ['many.txt'] });
      expect(result.matchesInPage).toBe(500);
      expect(result.truncated).toBe(true);
      expect(result.hasMore).toBe(false);
    });

    it('is not truncated when an un-paged result fits under the cap', async () => {
      const result = await run({ scope: 'targeted', targetedPaths: ['src'] });
      expect(result.truncated).toBe(false);
      expect(result.files).toHaveLength(5);
    });
  });

  describe('whole-word search through the line index', () => {
    const indexed = [
      { path: 'a.ts', matches: [hit(1), hit(4)] },
      { path: 'b.ts', matches: [hit(2)] },
      { path: 'c.ts', matches: [hit(3)] },
    ];

    const queryWord = vi.fn(() => Promise.resolve(indexed));

    beforeEach(() => {
      queryWord.mockClear();
      mocks.lineIndex = {
        queryWord,
        queryExactLine: vi.fn(() => Promise.resolve(indexed)),
      };
    });

    const word = { text: 'needle', word: true, caseSensitive: true };

    it('answers from the index instead of ripgrep and pages the array', async () => {
      const first = await run({ ...word, limit: 2 });
      expect(paths(first)).toEqual(['a.ts', 'b.ts']);
      expect(first).toMatchObject({ hasMore: true, nextOffset: 2, matchesInPage: 3 });

      const second = await run({ ...word, limit: 2, offset: 2 });
      expect(paths(second)).toEqual(['c.ts']);
      expect(second).toMatchObject({ hasMore: false, nextOffset: null });
    });

    it('applies the targeted scope before paging', async () => {
      const result = await run({
        ...word,
        scope: 'targeted',
        targetedPaths: ['b.ts', 'c.ts'],
        limit: 1,
      });
      expect(paths(result)).toEqual(['b.ts']);
      expect(result.hasMore).toBe(true);
    });

    it('falls back to ripgrep for text that is not a plain identifier', async () => {
      const result = await run({
        ...word,
        text: 'needle again',
        scope: 'targeted',
        targetedPaths: ['src/a.ts'],
      });
      expect(paths(result)).toEqual(['src/a.ts']);
    });

    it('falls back to ripgrep for a case-insensitive whole-word search', async () => {
      const result = await run({
        text: 'NEEDLE',
        word: true,
        scope: 'targeted',
        targetedPaths: ['src/a.ts'],
      });
      expect(queryWord).not.toHaveBeenCalled();
      expect(paths(result)).toEqual(['src/a.ts']);
      expect(result.matchesInPage).toBe(2);
    });
  });

  describe('exact-line search', () => {
    it('reads the line index when there is one', async () => {
      const queryExactLine = vi.fn(() =>
        Promise.resolve([{ path: 'z.ts', matches: [hit(1, 'const x = 1;')] }]),
      );
      mocks.lineIndex = { queryExactLine, queryWord: vi.fn() };
      const origin = { path: 'exact.ts', line: 1 };
      const result = await run({ kind: 'exactLine', text: '  const x = 1;  ', origin });
      expect(queryExactLine).toHaveBeenCalledWith('const x = 1;', origin);
      expect(paths(result)).toEqual(['z.ts']);
    });

    it('falls back to whole-line matches from ripgrep, excluding the origin line', async () => {
      const result = await run({
        kind: 'exactLine',
        text: 'const x = 1;',
        origin: { path: 'exact.ts', line: 1 },
      });
      expect(paths(result)).toEqual(['exact2.ts']);
      expect(result.files[0].matches.map((m) => m.line)).toEqual([1]);
    });
  });

  describe('references', () => {
    const referenced = [
      { path: 'x.ts', matches: [hit(1)] },
      { path: 'y.ts', matches: [hit(2)] },
      { path: 'z.ts', matches: [hit(3)] },
    ];
    const at = { path: 'x.ts', pos: { line: 1, col: 1 } };

    it('pages the references the language server returns', async () => {
      mocks.session = { references: vi.fn(() => Promise.resolve(referenced)) };
      const result = await run({ kind: 'references', text: 'sym', at, limit: 2 });
      expect(paths(result)).toEqual(['x.ts', 'y.ts']);
      expect(result).toMatchObject({ hasMore: true, nextOffset: 2 });
    });

    it('applies the targeted scope', async () => {
      mocks.session = { references: vi.fn(() => Promise.resolve(referenced)) };
      const result = await run({
        kind: 'references',
        text: 'sym',
        at,
        scope: 'targeted',
        targetedPaths: ['z.ts'],
      });
      expect(paths(result)).toEqual(['z.ts']);
    });

    it('is empty when no language session covers the file', async () => {
      const result = await run({ kind: 'references', text: 'sym', at });
      expect(result).toMatchObject({ files: [], hasMore: false, matchesInPage: 0 });
    });

    it('is empty, without asking the session, when the file is not in the worktree', async () => {
      const references = vi.fn(() => Promise.resolve(referenced));
      mocks.session = { references };
      const result = await run({
        kind: 'references',
        text: 'sym',
        at: { ...at, path: 'deleted.ts' },
      });
      expect(result).toMatchObject({ files: [], hasMore: false, matchesInPage: 0 });
      expect(references).not.toHaveBeenCalled();
    });
  });

  describe('stale requests', () => {
    it('reports STALE_SHA, not a cancellation, when the project moved to another commit', async () => {
      mocks.currentSha = 'b'.repeat(40);
      await expect(run({})).rejects.toMatchObject({ code: 'STALE_SHA' });
    });

    it('answers a request for the current commit', async () => {
      mocks.currentSha = SHA;
      await expect(run({ scope: 'targeted', targetedPaths: ['src/a.ts'] })).resolves.toMatchObject({
        matchesInPage: 2,
      });
    });
  });
});

function symbol(name: string, kind: WorkspaceSymbol['kind'] = 'function'): WorkspaceSymbol {
  return {
    name,
    kind,
    location: {
      path: `${name}.ts`,
      range: { start: { line: 1, col: 1 }, end: { line: 1, col: 2 } },
    },
  };
}

function sessionReturning(result: Promise<WorkspaceSymbol[]>): LanguageSession {
  return fakeLanguageSession({ workspaceSymbols: vi.fn(() => result) });
}

function query(limit?: number, kinds?: WorkspaceSymbol['kind'][]): Promise<WorkspaceSymbol[]> {
  return workspaceSymbols({ projectId: 'p', sha: 'sha', query: 'q', limit, kinds });
}

describe('symbols.workspace across sessions', () => {
  beforeEach(() => {
    mocks.sessions = [];
    mocks.currentSha = null;
  });

  it('merges the results of every session', async () => {
    mocks.sessions = [
      sessionReturning(Promise.resolve([symbol('a')])),
      sessionReturning(Promise.resolve([symbol('b'), symbol('c')])),
    ];

    expect((await query()).map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('caps the merged results at the requested limit', async () => {
    mocks.sessions = [
      sessionReturning(Promise.resolve([symbol('a'), symbol('b')])),
      sessionReturning(Promise.resolve([symbol('c'), symbol('d')])),
    ];

    expect((await query(3)).map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('still answers from the working sessions when one session fails', async () => {
    mocks.sessions = [
      sessionReturning(Promise.reject(new Error('server crashed'))),
      sessionReturning(Promise.resolve([symbol('b')])),
    ];

    expect((await query()).map((s) => s.name)).toEqual(['b']);
  });

  it('rethrows when every session fails', async () => {
    mocks.sessions = [
      sessionReturning(Promise.reject(new Error('first crashed'))),
      sessionReturning(Promise.reject(new Error('second crashed'))),
    ];

    await expect(query()).rejects.toThrow('first crashed');
  });

  it('returns no results when the project has no session', async () => {
    expect(await query()).toEqual([]);
  });

  it('keeps only the requested kinds, asking sessions for a wider pool than the limit', async () => {
    const workspaceSymbols = vi.fn<LanguageSession['workspaceSymbols']>(() =>
      Promise.resolve([
        symbol('run'),
        symbol('Foo', 'class'),
        symbol('count', 'variable'),
        symbol('Shape', 'interface'),
        symbol('Bar', 'class'),
      ]),
    );
    mocks.sessions = [fakeLanguageSession({ workspaceSymbols })];

    const out = await query(2, ['class', 'interface']);
    expect(out.map((s) => s.name)).toEqual(['Foo', 'Shape']);
    expect(workspaceSymbols.mock.calls[0][1]).toBeGreaterThan(2);
  });
});

describe('symbols for a file missing from the worktree', () => {
  const failing = (): Promise<never> => Promise.reject(new Error('ENOENT'));
  const input = { projectId: PROJECT, sha: SHA, path: 'deleted.ts' };
  let lineSymbolsFn: ReturnType<typeof vi.fn<LanguageSession['lineSymbols']>>;
  let definitionFn: ReturnType<typeof vi.fn<LanguageSession['definition']>>;
  let documentSymbolsFn: ReturnType<typeof vi.fn<LanguageSession['documentSymbols']>>;

  beforeAll(async () => {
    userData = await makeTmpDir('search-missing-file');
    __setUserDataDir(userData.path);
  });

  afterAll(async () => {
    await userData.cleanup();
  });

  beforeEach(() => {
    mocks.currentSha = null;
    lineSymbolsFn = vi.fn(failing);
    definitionFn = vi.fn(failing);
    documentSymbolsFn = vi.fn(failing);
    mocks.session = fakeLanguageSession({
      lineSymbols: lineSymbolsFn,
      definition: definitionFn,
      documentSymbols: documentSymbolsFn,
    });
  });

  it('returns no document symbols', async () => {
    await expect(documentSymbols(input)).resolves.toEqual({ path: 'deleted.ts', symbols: [] });
    expect(documentSymbolsFn).not.toHaveBeenCalled();
  });

  it('returns no line symbols', async () => {
    await expect(lineSymbols({ ...input, line: 1 })).resolves.toEqual({
      path: 'deleted.ts',
      line: 1,
      symbols: [],
    });
    expect(lineSymbolsFn).not.toHaveBeenCalled();
  });

  it('returns no definitions', async () => {
    await expect(definitionAt({ ...input, pos: { line: 1, col: 1 } })).resolves.toEqual({
      symbol: '',
      definitions: [],
    });
    expect(definitionFn).not.toHaveBeenCalled();
  });

  it('still asks the session once the file exists', async () => {
    await writeRepoFile('present.ts', 'export const a = 1;\n');
    documentSymbolsFn.mockResolvedValue([]);
    await documentSymbols({ ...input, path: 'present.ts' });
    expect(documentSymbolsFn).toHaveBeenCalledWith('present.ts', expect.anything());
  });
});
