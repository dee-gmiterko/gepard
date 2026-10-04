import type { MenuItemConstructorOptions } from 'electron';
import type {
  ContextMenuLabels,
  ContextMenuLineTarget,
  FileViewMenuPick,
  FileViewMenuRequest,
} from '@gepard/common';

export interface ContextMenuParams {
  isEditable: boolean;
  selectionText: string;
  misspelledWord: string;
  dictionarySuggestions: readonly string[];
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
}

export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void;
  addToDictionary: (word: string) => void;
  copyText: (text: string) => void;
}

export function formatLineReference(target: ContextMenuLineTarget): string {
  return `${target.path}:${target.line}`;
}

export function hasTextualContent(
  params: ContextMenuParams,
  target: ContextMenuLineTarget | null,
): boolean {
  return (
    params.isEditable ||
    params.selectionText.length > 0 ||
    params.editFlags.canSelectAll ||
    target !== null
  );
}

export function buildContextMenuTemplate(
  params: ContextMenuParams,
  labels: ContextMenuLabels,
  target: ContextMenuLineTarget | null,
  actions: ContextMenuActions,
): MenuItemConstructorOptions[] {
  const sections: MenuItemConstructorOptions[][] = [];

  if (params.isEditable && params.misspelledWord) {
    const word = params.misspelledWord;
    sections.push([
      ...params.dictionarySuggestions.map((suggestion): MenuItemConstructorOptions => ({
        label: suggestion,
        click: () => actions.replaceMisspelling(suggestion),
      })),
      { label: labels.addToDictionary, click: () => actions.addToDictionary(word) },
    ]);
  }

  const edit: MenuItemConstructorOptions[] = [];
  if (params.isEditable) {
    edit.push(
      { label: labels.undo, role: 'undo', enabled: params.editFlags.canUndo },
      { label: labels.redo, role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: labels.cut, role: 'cut', enabled: params.editFlags.canCut },
    );
  }
  edit.push({ label: labels.copy, role: 'copy', enabled: params.editFlags.canCopy });
  if (params.isEditable) {
    edit.push({ label: labels.paste, role: 'paste', enabled: params.editFlags.canPaste });
  }
  edit.push({
    label: labels.selectAll,
    role: 'selectAll',
    enabled: params.editFlags.canSelectAll,
  });
  sections.push(edit);

  if (target !== null) {
    sections.push([
      { label: labels.copyFilePath, click: () => actions.copyText(target.path) },
      {
        label: labels.copyLineReference,
        click: () => actions.copyText(formatLineReference(target)),
      },
    ]);
  }

  return sections.flatMap((section, i) =>
    i === 0 ? section : [{ type: 'separator' } as const, ...section],
  );
}

export function buildFileViewMenuTemplate(
  state: Pick<FileViewMenuRequest, 'wrapLongLines' | 'fullFileDiff'>,
  labels: ContextMenuLabels,
  onPick: (pick: FileViewMenuPick) => void,
): MenuItemConstructorOptions[] {
  return [
    {
      label: labels.wrapLongLines,
      type: 'checkbox',
      checked: state.wrapLongLines,
      click: () => onPick('wrapLongLines'),
    },
    {
      label: labels.fullFile,
      type: 'checkbox',
      checked: state.fullFileDiff,
      click: () => onPick('fullFile'),
    },
  ];
}
