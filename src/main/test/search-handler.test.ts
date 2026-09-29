import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchQuery, type GroupedResult } from '@gepard/common/ipc/schemas/search';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';

const mocks = vi.hoisted(() => ({
  currentSha: null as string | null,
  lineIndex: null as unknown,
  session: null as unknown,
}));

vi.mock('../lsp', () => ({
  indexer: {
    currentSha: () => mocks.currentSha,
    sessions: () => [],
    session: () => mocks.session,
    lineIndex: () => mocks.lineIndex,
  },
}));

const { searchHandlers } = await import('../ipc/handlers/search');

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
  const handler = searchHandlers['search.run'] as unknown as (
    input: unknown,
    ctx: unknown,
  ) => Promise<GroupedResult>;
  return handler(input, {});
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

    beforeEach(() => {
      mocks.lineIndex = {
        queryWord: vi.fn(async () => indexed),
        queryExactLine: vi.fn(async () => indexed),
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
      expect((mocks.lineIndex as { queryWord: unknown }).queryWord).not.toHaveBeenCalled();
      expect(paths(result)).toEqual(['src/a.ts']);
      expect(result.matchesInPage).toBe(2);
    });
  });

  describe('exact-line search', () => {
    it('reads the line index when there is one', async () => {
      const queryExactLine = vi.fn(async () => [
        { path: 'z.ts', matches: [hit(1, 'const x = 1;')] },
      ]);
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
      mocks.session = { references: vi.fn(async () => referenced) };
      const result = await run({ kind: 'references', text: 'sym', at, limit: 2 });
      expect(paths(result)).toEqual(['x.ts', 'y.ts']);
      expect(result).toMatchObject({ hasMore: true, nextOffset: 2 });
    });

    it('applies the targeted scope', async () => {
      mocks.session = { references: vi.fn(async () => referenced) };
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
