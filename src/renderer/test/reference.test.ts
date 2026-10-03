import { describe, expect, it } from 'vitest';
import {
  initialReferenceChoices,
  referencesFromResult,
  sameRef,
  toggleRefIn,
} from '../src/helpers/reference';
import type { CommentReference, GroupedResult } from '@gepard/common';

const sym: CommentReference = { path: 'a.ts', line: 1, kind: 'symbol' };
const exact: CommentReference = { path: 'a.ts', line: 1, kind: 'exact' };

describe('sameRef', () => {
  it('compares kind, path and line', () => {
    expect(sameRef(sym, { ...sym })).toBe(true);
    expect(sameRef(sym, exact)).toBe(false);
    expect(sameRef(sym, { ...sym, line: 2 })).toBe(false);
  });
});

describe('toggleRefIn', () => {
  it('adds a missing reference and removes an existing one', () => {
    expect(toggleRefIn([], sym)).toEqual([sym]);
    expect(toggleRefIn([sym, exact], sym)).toEqual([exact]);
  });
});

describe('initialReferenceChoices', () => {
  it('opens the sections matching the existing references', () => {
    expect(initialReferenceChoices([sym])).toMatchObject({
      symbolOpen: true,
      symbols: [sym],
      exactOpen: false,
      patternsDefaultOpen: false,
    });
  });

  it('starts closed with no references', () => {
    expect(initialReferenceChoices([])).toMatchObject({
      symbolOpen: false,
      exactOpen: false,
      patternsDefaultOpen: false,
      patterns: {},
    });
  });
});

describe('referencesFromResult', () => {
  it('flattens matches into references of the given kind', () => {
    const data: GroupedResult = {
      query: { kind: 'pattern', text: 'x', scope: 'all' },
      files: [
        {
          path: 'a.ts',
          moreMatches: false,
          matches: [
            { line: 1, preview: '', spans: [] },
            { line: 4, preview: '', spans: [] },
          ],
        },
        { path: 'b.ts', moreMatches: false, matches: [{ line: 2, preview: '', spans: [] }] },
      ],
      offset: 0,
      nextOffset: null,
      hasMore: false,
      truncated: false,
      matchesInPage: 3,
    };
    expect(referencesFromResult(data, 'pattern')).toEqual([
      { path: 'a.ts', line: 1, kind: 'pattern' },
      { path: 'a.ts', line: 4, kind: 'pattern' },
      { path: 'b.ts', line: 2, kind: 'pattern' },
    ]);
  });

  it('returns an empty list without data', () => {
    expect(referencesFromResult(undefined, 'exact')).toEqual([]);
  });
});
