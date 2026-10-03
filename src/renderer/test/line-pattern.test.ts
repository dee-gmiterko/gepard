import { describe, expect, it } from 'vitest';
import { buildLinePatterns, withoutExactMatches } from '../src/helpers/linePattern';
import type { GroupedResult } from '@gepard/common';

const range = (
  col: number,
): { start: { line: number; col: number }; end: { line: number; col: number } } => ({
  start: { line: 1, col },
  end: { line: 1, col: col + 1 },
});

describe('buildLinePatterns', () => {
  const line = '  const total = add(count, count);';
  const symbols = [
    { name: 'total', kind: 'variable' as const, range: range(9) },
    { name: 'add', kind: 'function' as const, range: range(17) },
    { name: 'count', kind: 'variable' as const, range: range(21) },
  ];
  const patterns = buildLinePatterns(line, symbols);

  it('replaces every occurrence of each non-function symbol with \\w+', () => {
    const regexes = patterns.map((p) => p.regex);
    expect(regexes).toContain(String.raw`^\s*const total = add\(\w+, \w+\);\s*$`);
    expect(regexes).toContain(String.raw`^\s*const \w+ = add\(count, count\);\s*$`);
    expect(regexes.some((r) => r.includes('\\w+ = \\w+'))).toBe(false);
  });

  it('keeps function symbols literal', () => {
    expect(patterns.every((p) => !p.regex.includes('\\w+\\('))).toBe(true);
  });

  it('adds a literal prefix pattern up to the end of each symbol', () => {
    const regexes = patterns.map((p) => p.regex);
    expect(regexes).toContain(String.raw`^\s*const total\b.*`);
    expect(regexes).toContain(String.raw`^\s*const total = add\b.*`);
  });

  it('produces valid regexes that match the source line', () => {
    for (const p of patterns) expect(new RegExp(p.regex).test(line)).toBe(true);
  });

  it('returns nothing for a blank line', () => {
    expect(buildLinePatterns('   ', symbols)).toEqual([]);
  });
});

describe('withoutExactMatches', () => {
  const data: GroupedResult = {
    query: { kind: 'regex', text: 'x', scope: 'all' },
    files: [
      {
        path: 'a.ts',
        moreMatches: false,
        matches: [
          { line: 1, preview: 'let a = 1;', spans: [] },
          { line: 2, preview: '  let b = 1;', spans: [] },
        ],
      },
      {
        path: 'b.ts',
        moreMatches: false,
        matches: [{ line: 3, preview: 'let a = 1;', spans: [] }],
      },
    ],
    offset: 0,
    nextOffset: null,
    hasMore: false,
    truncated: false,
    matchesInPage: 3,
  };

  it('drops exact line matches and the origin, and empty files', () => {
    const out = withoutExactMatches(data, 'let a = 1;', { path: 'a.ts', line: 2 });
    expect(out.files).toEqual([]);
    const kept = withoutExactMatches(data, 'let a = 1;', { path: 'z.ts', line: 1 });
    expect(kept.files.map((f) => [f.path, f.matches.map((m) => m.line)])).toEqual([['a.ts', [2]]]);
  });
});
