import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import type { ContextMenuLabels } from '@gepard/common';
import {
  buildContextMenuTemplate,
  buildFileViewMenuTemplate,
  hasTextualContent,
  type ContextMenuActions,
  type ContextMenuParams,
} from '../../helpers/contextMenu';

const labels: ContextMenuLabels = {
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select all',
  addToDictionary: 'Add to dictionary',
  copyFilePath: 'Copy file path',
  copyLineReference: 'Copy line reference',
  wrapLongLines: 'Wrap long lines',
  fullFile: 'Full file',
  randomizeOrder: 'Randomize order',
  incrementalDiff: 'Show incremental',
};

const flags = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: true,
  canPaste: false,
  canSelectAll: true,
};

function params(over: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return {
    isEditable: false,
    selectionText: '',
    misspelledWord: '',
    dictionarySuggestions: [],
    editFlags: flags,
    ...over,
  };
}

function actions(): ContextMenuActions {
  return { replaceMisspelling: vi.fn(), addToDictionary: vi.fn(), copyText: vi.fn() };
}

function clickItem(template: MenuItemConstructorOptions[], index: number): void {
  const click = template[index]?.click;
  if (!click) throw new Error(`menu item ${index} has no click handler`);
  Reflect.apply(click, undefined, []);
}

const labelsOf = (t: { label?: string; type?: string }[]): (string | undefined)[] =>
  t.map((i) => (i.type === 'separator' ? '-' : i.label));

describe('hasTextualContent', () => {
  it('is false without editable, selection, selectable text or line target', () => {
    const p = params({ editFlags: { ...flags, canSelectAll: false } });
    expect(hasTextualContent(p, null)).toBe(false);
    expect(hasTextualContent(p, { path: 'a', line: 1 })).toBe(true);
    expect(hasTextualContent(params({ selectionText: 'x' }), null)).toBe(true);
  });
});

describe('buildContextMenuTemplate', () => {
  it('offers copy and select all for read-only text', () => {
    const t = buildContextMenuTemplate(params(), labels, null, actions());
    expect(labelsOf(t)).toEqual(['Copy', 'Select all']);
  });

  it('adds full edit operations in editable fields', () => {
    const t = buildContextMenuTemplate(params({ isEditable: true }), labels, null, actions());
    expect(labelsOf(t)).toEqual(['Undo', 'Redo', '-', 'Cut', 'Copy', 'Paste', 'Select all']);
  });

  it('puts spelling suggestions first and wires their actions', () => {
    const a = actions();
    const t = buildContextMenuTemplate(
      params({ isEditable: true, misspelledWord: 'teh', dictionarySuggestions: ['the', 'tea'] }),
      labels,
      null,
      a,
    );
    expect(labelsOf(t).slice(0, 4)).toEqual(['the', 'tea', 'Add to dictionary', '-']);
    clickItem(t, 0);
    clickItem(t, 2);
    expect(a.replaceMisspelling).toHaveBeenCalledWith('the');
    expect(a.addToDictionary).toHaveBeenCalledWith('teh');
  });

  it('ignores misspellings outside editable fields', () => {
    const t = buildContextMenuTemplate(params({ misspelledWord: 'teh' }), labels, null, actions());
    expect(labelsOf(t)).toEqual(['Copy', 'Select all']);
  });

  it('appends copy path and line reference for a code line', () => {
    const a = actions();
    const t = buildContextMenuTemplate(params(), labels, { path: 'src/a.ts', line: 7 }, a);
    expect(labelsOf(t)).toEqual([
      'Copy',
      'Select all',
      '-',
      'Copy file path',
      'Copy line reference',
    ]);
    clickItem(t, 3);
    clickItem(t, 4);
    expect(a.copyText).toHaveBeenNthCalledWith(1, 'src/a.ts');
    expect(a.copyText).toHaveBeenNthCalledWith(2, 'src/a.ts:7');
  });
});

describe('buildFileViewMenuTemplate', () => {
  it('offers every toggle as a checkbox reflecting the current state', () => {
    const t = buildFileViewMenuTemplate(
      { wrapLongLines: true, fullFileDiff: false, randomizeOrder: true, incrementalDiff: false },
      labels,
      vi.fn(),
    );
    expect(t.map((i) => [i.label, i.type, i.checked])).toEqual([
      ['Wrap long lines', 'checkbox', true],
      ['Full file', 'checkbox', false],
      ['Randomize order', 'checkbox', true],
      ['Show incremental', 'checkbox', false],
    ]);
  });

  it('reports which toggle was picked', () => {
    const onPick = vi.fn();
    const t = buildFileViewMenuTemplate(
      { wrapLongLines: false, fullFileDiff: false, randomizeOrder: false, incrementalDiff: false },
      labels,
      onPick,
    );
    clickItem(t, 0);
    clickItem(t, 1);
    clickItem(t, 2);
    clickItem(t, 3);
    expect(onPick).toHaveBeenNthCalledWith(1, 'wrapLongLines');
    expect(onPick).toHaveBeenNthCalledWith(2, 'fullFile');
    expect(onPick).toHaveBeenNthCalledWith(3, 'randomizeOrder');
    expect(onPick).toHaveBeenNthCalledWith(4, 'incrementalDiff');
  });
});
