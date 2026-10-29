import { describe, expect, it } from 'vitest';
import { contextMenuEntries, hasTextMenuContent } from '../../src/helpers/contextMenu';

const text = {
  kind: 'text',
  x: 0,
  y: 0,
  editable: false,
  hasSelection: false,
  target: null,
} as const;

describe('hasTextMenuContent', () => {
  it('is empty without editable, selection or line target', () => {
    expect(hasTextMenuContent(text)).toBe(false);
    expect(hasTextMenuContent({ ...text, editable: true })).toBe(true);
    expect(hasTextMenuContent({ ...text, hasSelection: true })).toBe(true);
    expect(hasTextMenuContent({ ...text, target: { path: 'a', line: 1 } })).toBe(true);
  });
});

describe('contextMenuEntries', () => {
  it('offers only read actions for non-editable content', () => {
    expect(contextMenuEntries({ ...text, hasSelection: true })).toEqual([
      { key: 'copy', disabled: false },
      { key: 'selectAll' },
    ]);
  });

  it('adds editing and line reference entries, disabling cut and copy without a selection', () => {
    const entries = contextMenuEntries({
      ...text,
      editable: true,
      target: { path: 'src/a.ts', line: 7 },
    });
    expect(entries.map((e) => e.key)).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'selectAll',
      'copyFilePath',
      'copyLineReference',
    ]);
    expect(entries.filter((e) => e.disabled).map((e) => e.key)).toEqual(['cut', 'copy']);
    expect(entries.filter((e) => e.separatorBefore).map((e) => e.key)).toEqual([
      'cut',
      'copyFilePath',
    ]);
  });

  it('reflects the file view toggle state', () => {
    const entries = contextMenuEntries({
      kind: 'fileView',
      x: 0,
      y: 0,
      wrapLongLines: true,
      fullFileDiff: false,
      randomizeOrder: false,
      incrementalDiff: true,
      showCurrent: true,
      markdownPreview: true,
    });
    expect(entries.map((e) => [e.key, e.checked])).toEqual([
      ['wrapLongLines', true],
      ['fullFile', false],
      ['randomizeOrder', false],
      ['incrementalDiff', true],
      ['showCurrent', true],
      ['markdownPreview', true],
    ]);
  });
});
