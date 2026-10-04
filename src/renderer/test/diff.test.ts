import { describe, expect, it } from 'vitest';
import type { DiffRow } from '@gepard/common';
import {
  changeLines,
  changeSignature,
  findDiffDocLine,
  fullFileDiffMarks,
  matchesSimilar,
  similarMatcher,
  type ChangeRow,
} from '../src/helpers/diff';

const infos = [
  { oldLine: 1, newLine: 1 },
  { oldLine: 10, newLine: null },
  { oldLine: null, newLine: 20 },
  { oldLine: 3, newLine: 3 },
];

describe('findDiffDocLine', () => {
  it('finds the doc line for an added (RIGHT-only) line number', () => {
    expect(findDiffDocLine(infos, 20, 'RIGHT')).toBe(3);
  });

  it('finds the doc line for a deleted (LEFT-only) line number', () => {
    expect(findDiffDocLine(infos, 10, 'LEFT')).toBe(2);
  });

  it('finds a context line the same way on either side', () => {
    expect(findDiffDocLine(infos, 3, 'LEFT')).toBe(4);
    expect(findDiffDocLine(infos, 3, 'RIGHT')).toBe(4);
  });

  it('returns null when the line does not exist on the requested side', () => {
    expect(findDiffDocLine(infos, 10, 'RIGHT')).toBeNull();
    expect(findDiffDocLine(infos, 20, 'LEFT')).toBeNull();
    expect(findDiffDocLine(infos, 99, 'RIGHT')).toBeNull();
  });
});

const add = (text: string): ChangeRow => ({ kind: 'add', oldLine: null, newLine: 1, text });
const del = (text: string): ChangeRow => ({ kind: 'delete', oldLine: 1, newLine: null, text });
const ctx = (text: string): ChangeRow => ({ kind: 'context', oldLine: 1, newLine: 1, text });

describe('changeLines', () => {
  it('keeps only added and deleted rows, trimmed and prefixed', () => {
    expect(changeLines([ctx('x'), del('  old()'), add('  new()'), { ...ctx('hunk') }])).toEqual([
      '-old()',
      '+new()',
    ]);
  });

  it('builds an order-sensitive signature', () => {
    expect(changeSignature(['-a', '+b'])).not.toBe(changeSignature(['+b', '-a']));
  });
});

describe('similarMatcher', () => {
  const lines = ['-foo.run(foo)', '+bar(foo, x)'];
  const symbols = [
    [
      { name: 'foo', kind: 'variable' as const },
      { name: 'run', kind: 'method' as const },
    ],
    [
      { name: 'bar', kind: 'function' as const },
      { name: 'foo', kind: 'variable' as const },
      { name: 'x', kind: 'variable' as const },
    ],
  ];

  it('treats equal symbols as the same placeholder and keeps functions literal', () => {
    const matcher = similarMatcher(lines, symbols);
    if (!matcher) throw new Error('expected a matcher');
    expect(matchesSimilar(matcher, ['-baz.run(baz)', '+bar(baz, y)'])).toBe(true);
    expect(matchesSimilar(matcher, ['-baz.run(qux)', '+bar(baz, y)'])).toBe(false);
    expect(matchesSimilar(matcher, ['-baz.run(baz)', '+other(baz, y)'])).toBe(false);
  });

  it('returns null when no symbol is replaceable', () => {
    expect(similarMatcher(['+run()'], [[{ name: 'run', kind: 'function' as const }]])).toBeNull();
  });
});

describe('fullFileDiffMarks', () => {
  const hunk = (text: string): DiffRow => ({ kind: 'hunk', oldLine: null, newLine: null, text });
  const ctx = (oldLine: number, newLine: number): DiffRow => ({
    kind: 'context',
    oldLine,
    newLine,
    text: 'c',
  });
  const add = (newLine: number): DiffRow => ({ kind: 'add', oldLine: null, newLine, text: 'a' });
  const del = (oldLine: number, text: string): DiffRow => ({
    kind: 'delete',
    oldLine,
    newLine: null,
    text,
  });

  it('marks added lines by their new line number', () => {
    const marks = fullFileDiffMarks([hunk('@@'), ctx(1, 1), add(2), add(3), ctx(2, 4)]);
    expect([...marks.addedLines]).toEqual([2, 3]);
    expect(marks.deletedBefore.size).toBe(0);
  });

  it('places deleted lines before the new line that follows them', () => {
    const marks = fullFileDiffMarks([hunk('@@'), ctx(1, 1), del(2, 'x'), del(3, 'y'), add(2)]);
    expect(marks.deletedBefore.get(2)).toEqual(['x', 'y']);
  });

  it('places deletions at the end of a hunk after its last new line', () => {
    const marks = fullFileDiffMarks([
      hunk('@@'),
      ctx(1, 1),
      del(2, 'x'),
      hunk('@@'),
      ctx(9, 8),
      del(10, 'z'),
    ]);
    expect(marks.deletedBefore.get(2)).toEqual(['x']);
    expect(marks.deletedBefore.get(9)).toEqual(['z']);
  });
});
