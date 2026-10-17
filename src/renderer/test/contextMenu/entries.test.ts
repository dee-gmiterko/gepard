import { describe, expect, it, vi } from 'vitest';
import {
  buildFileViewEntries,
  buildTextEntries,
  formatLineReference,
  hasMenuContent,
} from '../../src/contextMenu/entries';

const label = (key: string): string => key;
const actions = { edit: vi.fn(), copyText: vi.fn() };

describe('hasMenuContent', () => {
  it('is empty without editable, selection or line target', () => {
    expect(hasMenuContent({ editable: false, hasSelection: false, target: null })).toBe(false);
    expect(
      hasMenuContent({ editable: false, hasSelection: false, target: { path: 'a', line: 1 } }),
    ).toBe(true);
  });
});

describe('buildTextEntries', () => {
  it('offers only read actions for non-editable content', () => {
    const entries = buildTextEntries(
      { editable: false, hasSelection: true, target: null },
      label,
      actions,
    );
    expect(entries.map((e) => e.label)).toEqual(['copy', 'selectAll']);
  });

  it('adds editing and line reference entries', () => {
    const target = { path: 'src/a.ts', line: 7 };
    const entries = buildTextEntries(
      { editable: true, hasSelection: false, target },
      label,
      actions,
    );
    expect(entries.map((e) => e.label)).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'selectAll',
      'copyFilePath',
      'copyLineReference',
    ]);
    expect(entries.find((e) => e.label === 'cut')?.disabled).toBe(true);
    entries.at(-1)?.onSelect();
    expect(actions.copyText).toHaveBeenCalledWith(formatLineReference(target));
    expect(formatLineReference(target)).toBe('src/a.ts:7');
  });
});

describe('buildFileViewEntries', () => {
  it('reflects the toggle state and reports picks', () => {
    const onPick = vi.fn();
    const entries = buildFileViewEntries(
      { wrapLongLines: true, fullFileDiff: false, randomizeOrder: false, incrementalDiff: true },
      label,
      onPick,
    );
    expect(entries.map((e) => [e.label, e.checked])).toEqual([
      ['wrapLongLines', true],
      ['fullFile', false],
      ['randomizeOrder', false],
      ['incrementalDiff', true],
    ]);
    entries[1]?.onSelect();
    expect(onPick).toHaveBeenCalledWith('fullFile');
  });
});
