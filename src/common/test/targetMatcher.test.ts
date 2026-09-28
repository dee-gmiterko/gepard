import { describe, expect, it } from 'vitest';
import { isTargeted } from '@gepard/common/model/paths';
import { makeTargetMatcher } from '@gepard/common/model/targetMatcher';

const targetLists: string[][] = [
  [],
  ['src'],
  ['src/'],
  ['src', 'docs/readme.md'],
  ['docs', '*.spec.ts'],
  ['docs', 'src/*.spec.ts'],
  ['src/**/*.ts', 'lib/*.js'],
  ['Button.tsx'],
  ['src/[a].ts'],
  ['a.ts', 'src/a.ts', 'src/*.md'],
];

const paths = [
  'src/a.ts',
  'src/sub/b.ts',
  'src/a.spec.ts',
  'src/[a].ts',
  'src/readme.md',
  'src-extra/b.ts',
  'docs/readme.md',
  'lib/x.js',
  'lib/x/y.js',
  'other/Button.tsx',
  'a.ts',
  'a.spec.ts',
];

describe('makeTargetMatcher', () => {
  it('gives the same answer as isTargeted for every path and target list', () => {
    for (const targets of targetLists) {
      const matches = makeTargetMatcher(targets);
      for (const path of paths) {
        expect(matches(path), `${JSON.stringify(targets)} vs ${path}`).toBe(
          isTargeted(path, targets),
        );
      }
    }
  });

  it('matches nothing for an empty list', () => {
    expect(makeTargetMatcher([])('src/a.ts')).toBe(false);
  });

  it('answers a glob target by its glob semantics, even for a path spelled like the glob', () => {
    const targets = ['src/[a].ts'];
    const matches = makeTargetMatcher(targets);
    for (const path of ['src/a.ts', 'src/[a].ts', 'src/b.ts']) {
      expect(matches(path)).toBe(isTargeted(path, targets));
    }
  });
});
