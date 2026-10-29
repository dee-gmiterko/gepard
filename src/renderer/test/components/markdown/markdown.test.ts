import { describe, expect, it } from 'vitest';
import type { DiffRow } from '@gepard/common';
import { isMarkdownPath, markdownDiffSegments as segments } from '../../../src/components/markdown';

const row = (kind: DiffRow['kind'], text: string): DiffRow => ({
  kind,
  oldLine: kind === 'add' ? null : 1,
  newLine: kind === 'delete' ? null : 1,
  text,
});

const withoutKeys = (rows: DiffRow[]): { kind: string; text: string }[] =>
  segments(rows).map(({ kind, text }) => ({ kind, text }));

describe('isMarkdownPath', () => {
  it('matches markdown extensions case-insensitively', () => {
    expect(isMarkdownPath('docs/README.md')).toBe(true);
    expect(isMarkdownPath('a.MARKDOWN')).toBe(true);
    expect(isMarkdownPath('a.mkd')).toBe(true);
  });

  it('rejects other files', () => {
    expect(isMarkdownPath('a.mdx')).toBe(false);
    expect(isMarkdownPath('md')).toBe(false);
    expect(isMarkdownPath('a.md.ts')).toBe(false);
  });
});

describe('markdownDiffSegments', () => {
  it('groups consecutive rows of the same kind', () => {
    expect(
      withoutKeys([
        row('hunk', '@@'),
        row('context', '# T'),
        row('delete', 'old 1'),
        row('delete', 'old 2'),
        row('add', 'new'),
        row('context', 'tail'),
      ]),
    ).toEqual([
      { kind: 'context', text: '# T' },
      { kind: 'delete', text: 'old 1\nold 2' },
      { kind: 'add', text: 'new' },
      { kind: 'context', text: 'tail' },
    ]);
  });

  it('splits segments at hunk boundaries', () => {
    expect(withoutKeys([row('add', 'a'), row('hunk', '@@'), row('add', 'b')])).toEqual([
      { kind: 'add', text: 'a' },
      { kind: 'add', text: 'b' },
    ]);
  });

  it('returns nothing for no rows', () => {
    expect(withoutKeys([])).toEqual([]);
  });
});
