import { describe, expect, it } from 'vitest';
import { SearchQuery } from '@gepard/common';
import { pageOptions, searchRunKey, toResult } from '../../../helpers/search/query';

const base = SearchQuery.parse({
  projectId: 'owner__repo',
  sha: 'a'.repeat(40),
  kind: 'pattern',
  text: 'foo',
  scope: 'all',
  offset: 0,
});

describe('pageOptions', () => {
  it('caps total matches when unpaged', () => {
    expect(pageOptions(base)).toMatchObject({
      limit: undefined,
      maxMatchesPerFile: undefined,
      maxTotalMatches: 500,
    });
  });

  it('applies a per-file default when paged and honors an explicit value', () => {
    const paged = { ...base, limit: 10, offset: 20 };
    expect(pageOptions(paged)).toMatchObject({
      offset: 20,
      limit: 10,
      maxMatchesPerFile: 50,
      maxTotalMatches: undefined,
    });
    expect(pageOptions({ ...paged, maxMatchesPerFile: 3 }).maxMatchesPerFile).toBe(3);
  });
});

describe('toResult', () => {
  const files = [
    { path: 'a.ts', moreMatches: false, matches: [{ line: 1, preview: 'x', spans: [] }] },
    {
      path: 'b.ts',
      moreMatches: false,
      matches: [
        { line: 1, preview: 'x', spans: [] },
        { line: 2, preview: 'y', spans: [] },
      ],
    },
  ];

  it('computes the next offset and match count when more pages exist', () => {
    const out = toResult(
      { ...base, offset: 4 },
      {
        files,
        hasMore: true,
        truncated: false,
      },
    );
    expect(out).toMatchObject({
      query: { kind: 'pattern', text: 'foo', scope: 'all' },
      offset: 4,
      nextOffset: 6,
      hasMore: true,
      matchesInPage: 3,
    });
  });

  it('has no next offset on the last page', () => {
    expect(toResult(base, { files, hasMore: false, truncated: true })).toMatchObject({
      nextOffset: null,
      truncated: true,
    });
  });
});

describe('searchRunKey', () => {
  const SHA = 'a'.repeat(40);
  const base: { projectId: string; sha: string; scope: 'all' } = {
    projectId: 'p',
    sha: SHA,
    scope: 'all',
  };
  const key = (query: SearchQuery): string => searchRunKey(SearchQuery.parse(query));

  it('gives the side-panel pattern search one slot (latest-wins per keystroke)', () => {
    expect(key({ ...base, kind: 'pattern', text: 'ab', word: false })).toBe(
      key({ ...base, kind: 'pattern', text: 'abc', word: false }),
    );
  });

  it('keeps "Same pattern in" for different symbols (two open editors) apart', () => {
    expect(key({ ...base, kind: 'pattern', text: 'foo', word: true })).not.toBe(
      key({ ...base, kind: 'pattern', text: 'bar', word: true }),
    );
  });

  it('keeps the side panel apart from "Same pattern in" on the same text', () => {
    expect(key({ ...base, kind: 'pattern', text: 'foo', word: false })).not.toBe(
      key({ ...base, kind: 'pattern', text: 'foo', word: true }),
    );
  });

  it('keys "Also in" by its anchor', () => {
    const at = (line: number): string =>
      key({ ...base, kind: 'exactLine', text: 'x', origin: { path: 'a.ts', line } });
    expect(at(1)).not.toBe(at(2));
  });

  it('keys references by symbol position', () => {
    const at = (col: number): string =>
      key({
        ...base,
        kind: 'references',
        text: 'x',
        at: { path: 'a.ts', pos: { line: 1, col } },
      });
    expect(at(1)).not.toBe(at(5));
  });

  it('keeps different projects apart', () => {
    expect(key({ ...base, kind: 'regex', text: 'a' })).not.toBe(
      key({ ...base, projectId: 'q', kind: 'regex', text: 'a' }),
    );
  });
});
