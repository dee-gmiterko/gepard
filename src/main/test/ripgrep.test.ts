import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comparePaths } from '@gepard/common';
import { ripgrepSearch, ripgrepSearchPage, type RipgrepPage } from '../helpers/process/ripgrep';
import { MAX_PREVIEW_CHARS } from '../helpers/search/preview';
import { makeTmpDir, type TmpDir } from './support/tmp';

describe('ripgrepSearch (real spawn)', () => {
  let dir: TmpDir;

  beforeAll(async () => {
    dir = await makeTmpDir('ripgrep');
    await writeFile(join(dir.path, 'fixed.txt'), 'Hello World\nfoo bar\n');
    await writeFile(join(dir.path, 'word.txt'), 'cat category concatenate cat\n');
    await writeFile(join(dir.path, 'case.txt'), 'Bar bar BAR\n');
    await mkdir(join(dir.path, 'sub'));
    await writeFile(join(dir.path, 'sub', 'regex.txt'), 'foo\nfoa\nbaz\n');
  });

  afterAll(async () => {
    await dir.cleanup();
  });

  it('finds a fixed-string match', async () => {
    const results = await ripgrepSearch({ cwd: dir.path, pattern: 'World', fixedString: true });
    expect(results).toEqual([
      { path: 'fixed.txt', matches: [{ line: 1, preview: 'Hello World', spans: [[6, 11]] }] },
    ]);
  });

  it('respects word boundaries (-w), grouping repeated matches on one line', () => {
    return ripgrepSearch({
      cwd: dir.path,
      pattern: 'cat',
      fixedString: true,
      word: true,
    }).then((results) => {
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('word.txt');
      expect(results[0].matches).toEqual([
        {
          line: 1,
          preview: 'cat category concatenate cat',
          spans: [
            [0, 3],
            [25, 28],
          ],
        },
      ]);
    });
  });

  it('ignores case unless caseSensitive is set, including when it is left unset', async () => {
    const search = (caseSensitive?: boolean): Promise<Array<[number, number]>> =>
      ripgrepSearch({
        cwd: dir.path,
        pattern: 'bar',
        fixedString: true,
        caseSensitive,
        paths: ['case.txt'],
      }).then((results) => results[0].matches[0].spans);

    expect(await search(false)).toEqual([
      [0, 3],
      [4, 7],
      [8, 11],
    ]);
    expect(await search(true)).toEqual([[4, 7]]);
    expect(await search()).toEqual(await search(false));
  });

  it('supports a regex pattern', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'fo[ao]',
      fixedString: false,
      paths: ['sub'],
    });
    expect(results).toEqual([
      {
        path: 'sub/regex.txt',
        matches: [
          { line: 1, preview: 'foo', spans: [[0, 3]] },
          { line: 2, preview: 'foa', spans: [[0, 3]] },
        ],
      },
    ]);
  });

  it('rejects on an invalid regex (rg exits > 1)', async () => {
    await expect(
      ripgrepSearch({ cwd: dir.path, pattern: '(unclosed', fixedString: false }),
    ).rejects.toThrow(/rg exited with code \d+/);
  });

  it('resolves empty when every targeted path is missing from the working tree', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'anything',
      fixedString: true,
      paths: ['does-not-exist.txt'],
    });
    expect(results).toEqual([]);
  });

  it('filters by a glob targeted path using the app’s own matchesTarget semantics', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'fo[ao]',
      fixedString: false,
      paths: ['sub/*.txt'],
    });
    expect(results).toEqual([
      {
        path: 'sub/regex.txt',
        matches: [
          { line: 1, preview: 'foo', spans: [[0, 3]] },
          { line: 2, preview: 'foa', spans: [[0, 3]] },
        ],
      },
    ]);
  });

  it('keeps a literal targeted path even when another targeted entry is a glob', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'foo',
      fixedString: true,
      paths: ['fixed.txt', 'sub/*.txt'],
    });
    expect(results.map((f) => f.path).sort()).toEqual(['fixed.txt', 'sub/regex.txt']);
  });

  it('does not match a bare glob against a file nested in a subdirectory (matchesTarget is anchored)', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'fo[ao]',
      fixedString: false,
      paths: ['*.txt'],
    });
    expect(results).toEqual([
      {
        path: 'fixed.txt',
        matches: [{ line: 2, preview: 'foo bar', spans: [[0, 3]] }],
      },
    ]);
  });

  it('finds matches in tracked dotfiles (--hidden), consistent with the line index', async () => {
    await writeFile(join(dir.path, '.dotfile'), 'needle in a dotfile\n');
    const results = await ripgrepSearch({ cwd: dir.path, pattern: 'needle', fixedString: true });
    expect(results).toContainEqual({
      path: '.dotfile',
      matches: [{ line: 1, preview: 'needle in a dotfile', spans: [[0, 6]] }],
    });
  });
});

const THREE_HITS = 'needle one\nneedle two\nneedle three\n';
const FILES = ['a/x.txt', 'a-b.txt', 'a.txt', 'b/c.txt', 'z.txt'];

describe('ripgrepSearchPage', () => {
  let dir: TmpDir;

  beforeAll(async () => {
    dir = await makeTmpDir('ripgrep-paging');
    for (const file of FILES) {
      await mkdir(dirname(join(dir.path, file)), { recursive: true });
      await writeFile(join(dir.path, file), THREE_HITS);
    }
    await writeFile(join(dir.path, 'ignored.txt'), 'needle in an ignored file\n');
    await writeFile(join(dir.path, '.ignore'), 'ignored.txt\n');
    await writeFile(join(dir.path, 'long.txt'), `${'x'.repeat(3000)}needle${'y'.repeat(3000)}\n`);
    await writeFile(join(dir.path, 'unicode.txt'), 'héllo 😀 needle\n');
    await writeFile(join(dir.path, 'other.txt'), 'nothing to see\n');
  });

  afterAll(async () => {
    await dir.cleanup();
  });

  const search = (extra: object = {}): Promise<RipgrepPage> =>
    ripgrepSearchPage({
      cwd: dir.path,
      pattern: 'needle',
      fixedString: true,
      ...extra,
    });

  const ALL = [...FILES, 'ignored.txt', 'long.txt', 'unicode.txt'].sort(comparePaths);

  it('returns files in the component-wise path order comparePaths defines', async () => {
    const { files } = await search();
    expect(files.map((f) => f.path)).toEqual(ALL);
  });

  it('pages concatenate to the unpaged result, with hasMore true until the last page', async () => {
    const seen: string[] = [];
    const flags: boolean[] = [];
    for (let offset = 0, more = true; more; offset += 3) {
      const page = await search({ offset, limit: 3 });
      seen.push(...page.files.map((f) => f.path));
      flags.push(page.hasMore);
      more = page.hasMore;
    }
    expect(seen).toEqual(ALL);
    expect(flags).toEqual([true, true, false]);
  });

  it('is empty, with nothing more, past the last file', async () => {
    expect(await search({ offset: 50, limit: 3 })).toEqual({
      files: [],
      hasMore: false,
      truncated: false,
    });
  });

  it('does not report more when the page ends exactly at the last file', async () => {
    const page = await search({ offset: 0, limit: ALL.length });
    expect(page.files).toHaveLength(ALL.length);
    expect(page.hasMore).toBe(false);
  });

  it('counts only targeted files toward offset and limit', async () => {
    const paths = ['b/c.txt', 'z.txt', 'a/x.txt'];
    const first = await search({ paths, limit: 1 });
    expect(first.files.map((f) => f.path)).toEqual(['a/x.txt']);
    expect(first.hasMore).toBe(true);
    const second = await search({ paths, offset: 1, limit: 5 });
    expect(second.files.map((f) => f.path)).toEqual(['b/c.txt', 'z.txt']);
    expect(second.hasMore).toBe(false);
  });

  it('caps the matches per file and flags only the files that had more', async () => {
    const { files } = await search({ maxMatchesPerFile: 2, paths: ['a.txt', 'long.txt'] });
    const byPath = new Map(files.map((f) => [f.path, f]));
    expect(byPath.get('a.txt')?.matches.map((m) => m.line)).toEqual([1, 2]);
    expect(byPath.get('a.txt')?.moreMatches).toBe(true);
    expect(byPath.get('long.txt')?.matches).toHaveLength(1);
    expect(byPath.get('long.txt')?.moreMatches).toBeUndefined();
  });

  it('stops at the total match cap and reports truncation', async () => {
    const page = await search({ maxTotalMatches: 4 });
    expect(page.truncated).toBe(true);
    expect(page.files.reduce((n, f) => n + f.matches.length, 0)).toBe(4);
  });

  it('is not truncated when the cap is larger than the result', async () => {
    const page = await search({ maxTotalMatches: 1000 });
    expect(page.truncated).toBe(false);
  });

  it('searches files an ignore rule would hide, like the line index does', async () => {
    const { files } = await search();
    expect(files.map((f) => f.path)).toContain('ignored.txt');
  });

  it('clips a very long line around the match, keeping the span on the match', async () => {
    const { files } = await search({ paths: ['long.txt'] });
    const [match] = files[0].matches;
    expect(match.preview.length).toBeLessThanOrEqual(MAX_PREVIEW_CHARS);
    const [[start, end]] = match.spans;
    expect(match.preview.slice(start, end)).toBe('needle');
  });

  it('keeps the offsets of a match that follows non-ASCII text on its line', async () => {
    const { files } = await search({ paths: ['unicode.txt'] });
    const [[start, end]] = files[0].matches[0].spans;
    expect(files[0].matches[0].preview.slice(start, end)).toBe('needle');
  });

  it('returns nothing when the pattern matches no file', async () => {
    expect(await search({ pattern: 'absent-everywhere' })).toEqual({
      files: [],
      hasMore: false,
      truncated: false,
    });
  });

  it('rejects with an AbortError when its signal is aborted', async () => {
    await expect(search({ signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('agrees with the un-paged wrapper', async () => {
    const wrapped = await ripgrepSearch({ cwd: dir.path, pattern: 'needle', fixedString: true });
    expect(wrapped.map((f) => f.path)).toEqual(ALL);
  });
});

describe('ripgrepSearch spans with multi-byte text (real spawn)', () => {
  let dir: TmpDir;

  beforeAll(async () => {
    dir = await makeTmpDir('ripgrep-utf16');
    await writeFile(join(dir.path, 'emoji.txt'), '\u{1F600}x\n');
    await writeFile(join(dir.path, 'bmp.txt'), 'caf\u00e9 bar\n');
    await writeFile(join(dir.path, 'ascii.txt'), 'plain bar\n');
  });

  afterAll(async () => {
    await dir.cleanup();
  });

  const spans = async (file: string, pattern: string): Promise<unknown> => {
    const results = await ripgrepSearch({ cwd: dir.path, pattern, fixedString: true });
    return results.find((r) => r.path === file)?.matches[0].spans;
  };

  it('converts spans for ASCII and BMP multi-byte lines', async () => {
    expect(await spans('ascii.txt', 'bar')).toEqual([[6, 9]]);
    expect(await spans('bmp.txt', 'bar')).toEqual([[5, 8]]);
  });

  it('a match right after an emoji spans [2,3]', async () => {
    expect(await spans('emoji.txt', 'x')).toEqual([[2, 3]]);
  });

  it('a match on the emoji itself spans [0,2]', async () => {
    expect(await spans('emoji.txt', '\u{1F600}')).toEqual([[0, 2]]);
  });
});
