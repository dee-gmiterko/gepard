import { describe, expect, it } from 'vitest';
import { rankNavigation } from '../src/features/quickSearch/navigationMatches';
import type { WorkspaceSymbol } from '@gepard/common';

function symbol(
  name: string,
  path: string,
  line = 3,
  kind: WorkspaceSymbol['kind'] = 'class',
): WorkspaceSymbol {
  return {
    name,
    kind,
    location: { path, range: { start: { line, col: 1 }, end: { line, col: 2 } } },
  };
}

const files = [
  'src/app/main.ts',
  'src/renderer/src/features/search/SearchPanel.tsx',
  'src/renderer/src/components/Tree/Tree.tsx',
  'docs/search.md',
];

describe('rankNavigation', () => {
  it('returns nothing for a blank query', () => {
    expect(rankNavigation('  ', files, [], new Set())).toEqual([]);
  });

  it('drops files that do not fuzzy-match the query', () => {
    const paths = rankNavigation('search', files, [], new Set()).map((m) => m.path);
    expect(paths).toEqual(['docs/search.md', 'src/renderer/src/features/search/SearchPanel.tsx']);
  });

  it('ranks targeted files above untargeted ones', () => {
    const targeted = new Set(['src/renderer/src/features/search/SearchPanel.tsx']);
    const paths = rankNavigation('search', files, [], targeted).map((m) => m.path);
    expect(paths[0]).toBe('src/renderer/src/features/search/SearchPanel.tsx');
  });

  it('ranks a symbol whose name is the query above path matches and reports its line', () => {
    const symbols = [symbol('Tree', 'src/renderer/src/components/Tree/Tree.tsx', 12)];
    const [first] = rankNavigation('tree', files, symbols, new Set());
    expect(first).toMatchObject({ kind: 'symbol', path: symbols[0].location.path, line: 12 });
  });

  it('highlights the matched part of the path for files and of the name for symbols', () => {
    const [file] = rankNavigation('main', files, [], new Set());
    expect(file.kind).toBe('file');
    expect(file.ranges).toEqual([[8, 12]]);
    const [sym] = rankNavigation('Pan', [], [symbol('SearchPanel', 'a.ts')], new Set());
    expect(sym.kind).toBe('symbol');
    expect(sym.ranges).toEqual([[6, 9]]);
  });

  it('opens files at the top (no line) and dedupes identical symbols', () => {
    const dup = symbol('Foo', 'foo.ts');
    const out = rankNavigation('foo', ['foo.ts'], [dup, { ...dup }], new Set());
    expect(out.map((m) => [m.kind, m.line])).toEqual([
      ['symbol', 3],
      ['file', null],
    ]);
  });

  it('caps the list at the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`);
    expect(rankNavigation('file', many, [], new Set())).toHaveLength(8);
    expect(rankNavigation('file', many, [], new Set(), 3)).toHaveLength(3);
  });
});
