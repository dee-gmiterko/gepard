import { describe, expect, it } from 'vitest';
import {
  combineReferences,
  derivePatternViews,
  exactDisabledReason,
  initialReferenceChoices,
  isSymbolDisabled,
  lineTextOf,
  referencesFromResult,
  sameRef,
  targetedPatternsOf,
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

const groupedResult = (files: GroupedResult['files']): GroupedResult => ({
  query: { kind: 'pattern', text: 'x', scope: 'all' },
  files,
  offset: 0,
  nextOffset: null,
  hasMore: false,
  truncated: false,
  matchesInPage: files.length,
});
const result = (path: string, line: number, preview: string): GroupedResult =>
  groupedResult([{ path, moreMatches: false, matches: [{ line, preview, spans: [] }] }]);
const empty = groupedResult([]);
const origin = { path: 'a.ts', line: 1 };
const patterns = [
  { id: 'p1', display: 'foo', regex: 'foo' },
  { id: 'p2', display: 'bar', regex: 'bar' },
];

describe('lineTextOf', () => {
  it('returns the 1-based line of text content', () => {
    expect(lineTextOf({ kind: 'text', text: 'a\nb' }, 2)).toBe('b');
  });
  it('returns null for missing, non-text or out-of-range content', () => {
    expect(lineTextOf(undefined, 1)).toBeNull();
    expect(lineTextOf({ kind: 'binary' }, 1)).toBeNull();
    expect(lineTextOf({ kind: 'text', text: 'a' }, 3)).toBeNull();
  });
});

describe('isSymbolDisabled', () => {
  const def = (
    path: string,
    line: number,
    external = false,
  ): Parameters<typeof isSymbolDisabled>[0][number] => ({
    external,
    location: { path, range: { start: { line } } },
  });
  it('is disabled only when settled and no definition elsewhere exists', () => {
    expect(isSymbolDisabled([def('a.ts', 1)], origin, true)).toBe(true);
    expect(isSymbolDisabled([def('a.ts', 1, true)], origin, true)).toBe(true);
    expect(isSymbolDisabled([def('b.ts', 1)], origin, true)).toBe(false);
    expect(isSymbolDisabled([], origin, false)).toBe(false);
  });
});

describe('exactDisabledReason', () => {
  it('reports blank lines and absent matches', () => {
    expect(exactDisabledReason('', undefined)).toBe('blankLine');
    expect(exactDisabledReason('x', empty)).toBe('noOtherMatch');
    expect(exactDisabledReason('x', undefined)).toBeNull();
    expect(exactDisabledReason('x', result('b.ts', 2, 'x'))).toBeNull();
  });
});

describe('targetedPatternsOf', () => {
  it('keeps open patterns with targeted scope', () => {
    const choices = {
      ...initialReferenceChoices([]),
      patterns: { p1: { open: true, scope: 'targeted' as const }, p2: { open: true } },
    };
    expect(targetedPatternsOf(patterns, choices).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('derivePatternViews', () => {
  const base = { patterns, lineText: 'foo bar', origin };
  it('skips patterns without other matches and withholds data while closed', () => {
    const { views, references } = derivePatternViews({
      ...base,
      choices: initialReferenceChoices([]),
      anywhere: [{ data: result('b.ts', 3, 'foo x') }, { data: result('a.ts', 1, 'foo bar') }],
      targeted: [],
    });
    expect(views).toEqual([{ id: 'p1', display: 'foo', data: undefined, fetching: false }]);
    expect(references).toEqual([]);
  });

  it('uses targeted results for targeted scope and dedupes references', () => {
    const hit = result('b.ts', 3, 'foo x');
    const choices = {
      ...initialReferenceChoices([{ path: 'x', line: 1, kind: 'pattern' }]),
      patterns: { p2: { scope: 'targeted' as const } },
    };
    const { views, references } = derivePatternViews({
      ...base,
      choices,
      anywhere: [{ data: hit }, { data: hit }],
      targeted: [{ data: hit, isFetching: true }],
    });
    expect(views.map((v) => [v.id, v.fetching])).toEqual([
      ['p1', false],
      ['p2', true],
    ]);
    expect(references).toEqual([{ path: 'b.ts', line: 3, kind: 'pattern' }]);
  });
});

describe('combineReferences', () => {
  it('orders symbols, exact matches, then patterns', () => {
    const sym: CommentReference = { path: 's', line: 1, kind: 'symbol' };
    const pat: CommentReference = { path: 'p', line: 1, kind: 'pattern' };
    const choices = { ...initialReferenceChoices([sym]), exactOpen: true };
    expect(combineReferences(choices, result('e', 2, 'x'), [pat])).toEqual([
      sym,
      { path: 'e', line: 2, kind: 'exact' },
      pat,
    ]);
    expect(combineReferences({ ...choices, exactOpen: false }, result('e', 2, 'x'), [])).toEqual([
      sym,
    ]);
  });
});
