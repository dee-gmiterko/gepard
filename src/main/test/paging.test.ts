import { describe, expect, it } from 'vitest';
import { applyPage, type PageSourceFile } from '../helpers/search/paging';
import { MAX_PREVIEW_CHARS } from '../helpers/search/preview';

function file(path: string, matchCount = 1): PageSourceFile {
  return {
    path,
    matches: Array.from({ length: matchCount }, (_, i) => ({
      line: i + 1,
      preview: `hit ${i + 1}`,
      spans: [[0, 3] satisfies [number, number]],
    })),
  };
}

const five = ['a', 'b', 'c', 'd', 'e'].map((n) => file(`${n}.ts`));

describe('applyPage', () => {
  it('returns everything, with no more to load, when no limit is given', () => {
    const page = applyPage(five);
    expect(page.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']);
    expect(page.hasMore).toBe(false);
    expect(page.truncated).toBe(false);
  });

  it('takes `limit` files starting at `offset` and says whether more follow', () => {
    expect(applyPage(five, { offset: 0, limit: 2 })).toMatchObject({ hasMore: true });
    const middle = applyPage(five, { offset: 2, limit: 2 });
    expect(middle.files.map((f) => f.path)).toEqual(['c.ts', 'd.ts']);
    expect(middle.hasMore).toBe(true);
    const last = applyPage(five, { offset: 4, limit: 2 });
    expect(last.files.map((f) => f.path)).toEqual(['e.ts']);
    expect(last.hasMore).toBe(false);
  });

  it('pages concatenate to the whole result', () => {
    const seen: string[] = [];
    for (let offset = 0, more = true; more; offset += 2) {
      const page = applyPage(five, { offset, limit: 2 });
      seen.push(...page.files.map((f) => f.path));
      more = page.hasMore;
    }
    expect(seen).toEqual(five.map((f) => f.path));
  });

  it('is empty, with nothing more, past the end', () => {
    expect(applyPage(five, { offset: 9, limit: 2 })).toEqual({
      files: [],
      hasMore: false,
      truncated: false,
    });
  });

  it('caps the matches per file and flags the file that had more', () => {
    const page = applyPage([file('a.ts', 5), file('b.ts', 2)], { maxMatchesPerFile: 3 });
    expect(page.files.map((f) => [f.matches.length, f.moreMatches])).toEqual([
      [3, true],
      [2, false],
    ]);
    expect(page.truncated).toBe(false);
  });

  it('stops at the total cap, keeping the partial file and marking the result truncated', () => {
    const page = applyPage([file('a.ts', 3), file('b.ts', 3), file('c.ts', 3)], {
      maxTotalMatches: 5,
    });
    expect(page.files.map((f) => [f.path, f.matches.length, f.moreMatches])).toEqual([
      ['a.ts', 3, false],
      ['b.ts', 2, true],
    ]);
    expect(page.truncated).toBe(true);
  });

  it('is not truncated when the total cap lands exactly on the end', () => {
    const page = applyPage([file('a.ts', 3), file('b.ts', 2)], { maxTotalMatches: 5 });
    expect(page.files).toHaveLength(2);
    expect(page.truncated).toBe(false);
  });

  it('clips an over-long preview', () => {
    const long = { path: 'a.ts', matches: [{ line: 1, preview: 'x'.repeat(5000), spans: [] }] };
    expect(applyPage([long]).files[0].matches[0].preview.length).toBeLessThanOrEqual(
      MAX_PREVIEW_CHARS,
    );
  });
});
