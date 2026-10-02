import { describe, expect, it } from 'vitest';
import { SearchQuery } from '@gepard/common';
import { pageOptions, toResult } from '../helpers/search/query';

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
