import { describe, expect, it } from 'vitest';
import { buildSearchRows, countMatches, type FileMatches } from '../src/helpers/search';

function file(path: string, lines: number[] = [1], moreMatches = false): FileMatches {
  return {
    path,
    moreMatches,
    matches: lines.map((line) => ({ line, preview: `line ${line}`, spans: [[0, 4]] })),
  };
}

const always = (): boolean => true;
const never = (): boolean => false;
const describeRows = (rows: ReturnType<typeof buildSearchRows>): string[] =>
  rows.map((r) => `${r.kind}:${'path' in r ? r.path : r.key}@${r.depth}`);

describe('buildSearchRows', () => {
  const files = [file('a/x.ts', [1, 2]), file('a/b/y.ts'), file('a.ts'), file('z/q.ts')];

  it('opens folders as the path changes and nests matches under expanded files', () => {
    expect(describeRows(buildSearchRows(files, 'tree', always))).toEqual([
      'folder:a@0',
      'file:a/x.ts@1',
      'match:m:a/x.ts#0@2',
      'match:m:a/x.ts#1@2',
      'folder:a/b@1',
      'file:a/b/y.ts@2',
      'match:m:a/b/y.ts#0@3',
      'file:a.ts@0',
      'match:m:a.ts#0@1',
      'folder:z@0',
      'file:z/q.ts@1',
      'match:m:z/q.ts#0@2',
    ]);
  });

  it('hides the contents of a collapsed folder but not its siblings', () => {
    const rows = buildSearchRows(files, 'tree', (path) => path !== 'a');
    expect(describeRows(rows)).toEqual([
      'folder:a@0',
      'file:a.ts@0',
      'match:m:a.ts#0@1',
      'folder:z@0',
      'file:z/q.ts@1',
      'match:m:z/q.ts#0@2',
    ]);
  });

  it('hides only the matches of a collapsed file', () => {
    const rows = buildSearchRows(files, 'tree', (path) => path !== 'a/x.ts');
    expect(describeRows(rows).slice(0, 4)).toEqual([
      'folder:a@0',
      'file:a/x.ts@1',
      'folder:a/b@1',
      'file:a/b/y.ts@2',
    ]);
  });

  it('lists files with their full path when flat', () => {
    const rows = buildSearchRows(files, 'flat', never);
    expect(rows.map((r) => (r.kind === 'file' ? r.name : r.kind))).toEqual([
      'a/x.ts',
      'a/b/y.ts',
      'a.ts',
      'z/q.ts',
    ]);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });

  it('only appends when another page arrives, so existing rows never move', () => {
    const first = buildSearchRows(files.slice(0, 2), 'tree', always);
    const all = buildSearchRows(files, 'tree', always);
    expect(all.slice(0, first.length)).toEqual(first);
  });

  it('gives every row a distinct key', () => {
    const keys = buildSearchRows(files, 'tree', always).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns no rows for no files', () => {
    expect(buildSearchRows([], 'tree', always)).toEqual([]);
  });
});

describe('countMatches', () => {
  it('sums the matches carried by the files', () => {
    expect(countMatches([file('a.ts', [1, 2, 3]), file('b.ts', [4])])).toBe(4);
    expect(countMatches([])).toBe(0);
  });
});
