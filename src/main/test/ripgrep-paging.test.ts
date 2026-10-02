import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comparePaths } from '@gepard/common';
import { ripgrepSearch, ripgrepSearchPage, type RipgrepPage } from '../helpers/process/ripgrep';
import { MAX_PREVIEW_CHARS } from '../helpers/search/preview';
import { makeTmpDir, type TmpDir } from './support/tmp';

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
