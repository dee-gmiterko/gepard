import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import {
  buildContextMenuTemplate,
  formatLineReference,
  hasTextualContent,
  type ContextMenuActions,
  type ContextMenuParams,
} from '../helpers/contextMenu';

const labels = {
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select all',
  addToDictionary: 'Add to dictionary',
  copyFilePath: 'Copy file path',
  copyLineReference: 'Copy line reference',
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

describe('formatLineReference', () => {
  it('joins path and line with a colon', () => {
    expect(formatLineReference({ path: 'src/a.ts', line: 12 })).toBe('src/a.ts:12');
  });
});

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
