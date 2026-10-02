import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ripgrepSearch } from '../helpers/process/ripgrep';
import { byteOffsetToUtf16, utf16ByteBoundaries } from '../helpers/string';
import { makeTmpDir, type TmpDir } from './support/tmp';

describe('utf16ByteBoundaries / byteOffsetToUtf16', () => {
  it('maps ASCII text 1:1 (bytes === UTF-16 units)', () => {
    const boundaries = utf16ByteBoundaries('hello');
    expect(boundaries).toEqual([0, 1, 2, 3, 4, 5]);
    expect(byteOffsetToUtf16(boundaries, 3)).toBe(3);
  });

  it('maps an astral character (surrogate pair, 4 UTF-8 bytes) to 2 UTF-16 units', () => {
    const text = '\u{1F600} smile';
    const boundaries = utf16ByteBoundaries(text);
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(3);
    expect(byteOffsetToUtf16(boundaries, 10)).toBe(8);
  });

  it('maps a BMP multi-byte character (e.g. "é", 2 UTF-8 bytes, 1 UTF-16 unit)', () => {
    const text = 'café bar';
    const boundaries = utf16ByteBoundaries(text);
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(4);
  });
});

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
