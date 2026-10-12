import { describe, expect, it } from 'vitest';
import {
  firstFileToReview,
  nextRandomizedFile,
  nextReviewFile,
  nextTargetedFile,
  pathSeed,
} from '../../src/helpers/targetedFiles';

const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];

describe('nextTargetedFile', () => {
  it('returns null for an empty list', () => {
    expect(nextTargetedFile([], null, new Set(), 1)).toBeNull();
  });

  it('moves to the next file in the list', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(), 1)).toBe('b.ts');
  });

  it('moves to the previous file in the list', () => {
    expect(nextTargetedFile(files, 'b.ts', new Set(), -1)).toBe('a.ts');
  });

  it('wraps around at the ends', () => {
    expect(nextTargetedFile(files, 'd.ts', new Set(), 1)).toBe('a.ts');
    expect(nextTargetedFile(files, 'a.ts', new Set(), -1)).toBe('d.ts');
  });

  it('skips viewed files', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(['b.ts']), 1)).toBe('c.ts');
  });

  it('returns null when every other file is viewed', () => {
    expect(nextTargetedFile(files, 'a.ts', new Set(['b.ts', 'c.ts', 'd.ts']), 1)).toBeNull();
  });

  it('starts before the first file going down with no active file', () => {
    expect(nextTargetedFile(files, null, new Set(), 1)).toBe('a.ts');
  });

  it('starts after the last file going up with no active file', () => {
    expect(nextTargetedFile(files, null, new Set(), -1)).toBe('d.ts');
  });

  it('starts before the first file going down when the active file is not in the list', () => {
    expect(nextTargetedFile(files, 'missing.ts', new Set(), 1)).toBe('a.ts');
  });
});

describe('pathSeed', () => {
  it('is a deterministic unsigned 32-bit hash of the path', () => {
    expect(pathSeed('a.ts')).toBe(2071326719);
    expect(pathSeed('a.ts')).toBe(pathSeed('a.ts'));
    expect(pathSeed('b.ts')).not.toBe(pathSeed('a.ts'));
    expect(pathSeed('')).toBe(0x811c9dc5);
  });
});

describe('nextRandomizedFile', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];

  it('picks the unviewed file at the offset seeded by the active path', () => {
    expect(nextRandomizedFile(files, 'a.ts', new Set(), 1)).toBe('e.ts');
    expect(nextRandomizedFile(files, 'b.ts', new Set(), 1)).toBe('a.ts');
    expect(nextRandomizedFile(files, 'c.ts', new Set(), 1)).toBe('b.ts');
  });

  it('is deterministic for the same inputs', () => {
    const viewed = new Set(['b.ts']);
    expect(nextRandomizedFile(files, 'a.ts', viewed, 1)).toBe(
      nextRandomizedFile(files, 'a.ts', viewed, 1),
    );
  });

  it('takes the offset modulo the number of unviewed files', () => {
    expect(nextRandomizedFile(files, 'a.ts', new Set(['e.ts']), 1)).toBe('d.ts');
    expect(nextRandomizedFile(files, 'a.ts', new Set(['b.ts', 'e.ts']), 1)).toBe('d.ts');
    expect(nextRandomizedFile(files, 'a.ts', new Set(['b.ts', 'c.ts', 'e.ts']), 1)).toBe('d.ts');
  });

  it('never returns the active file or a viewed one', () => {
    for (const active of files) {
      for (const viewed of [new Set<string>(), new Set(['a.ts', 'c.ts']), new Set(['e.ts'])]) {
        const next = nextRandomizedFile(files, active, viewed, 1);
        expect(next).not.toBe(active);
        if (next !== null) expect(viewed.has(next)).toBe(false);
      }
    }
  });

  it('mirrors the offset when going backwards', () => {
    expect(nextRandomizedFile(files, 'a.ts', new Set(), -1)).toBe('b.ts');
    expect(nextRandomizedFile(files, 'b.ts', new Set(), -1)).toBe('e.ts');
  });

  it('returns null when every other file is viewed', () => {
    expect(
      nextRandomizedFile(files, 'a.ts', new Set(['b.ts', 'c.ts', 'd.ts', 'e.ts']), 1),
    ).toBeNull();
    expect(nextRandomizedFile([], null, new Set(), 1)).toBeNull();
  });

  it('falls back to the tree walk without an active file in the list', () => {
    expect(nextRandomizedFile(files, null, new Set(['a.ts']), 1)).toBe('b.ts');
    expect(nextRandomizedFile(files, 'missing.ts', new Set(), -1)).toBe('e.ts');
  });
});

describe('nextReviewFile', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];

  it('walks the tree order unless randomized', () => {
    expect(nextReviewFile(files, 'a.ts', new Set(), 1, false)).toBe('b.ts');
    expect(nextReviewFile(files, 'a.ts', new Set(), 1, true)).toBe('e.ts');
  });
});

describe('firstFileToReview', () => {
  const files = ['a.ts', 'b.ts', 'c.ts'];

  it('starts at the first unviewed file', () => {
    expect(firstFileToReview(files, new Set(['a.ts']))).toBe('b.ts');
  });

  it('falls back to the first file when all are viewed', () => {
    expect(firstFileToReview(files, new Set(files))).toBe('a.ts');
  });

  it('is null without files', () => {
    expect(firstFileToReview([], new Set())).toBeNull();
  });
});
