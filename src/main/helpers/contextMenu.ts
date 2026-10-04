import type { MenuItemConstructorOptions } from 'electron';
import {
  FileViewMenuPick,
  type ContextMenuLabelKey,
  type ContextMenuLabels,
  type ContextMenuLineTarget,
  type FileViewMenuRequest,
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

const EDIT_ITEMS: readonly {
  key: Extract<ContextMenuLabelKey, 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'>;
  flag: keyof ContextMenuParams['editFlags'];
  editableOnly: boolean;
  separatorBefore?: boolean;
}[] = [
  { key: 'undo', flag: 'canUndo', editableOnly: true },
  { key: 'redo', flag: 'canRedo', editableOnly: true },
  { key: 'cut', flag: 'canCut', editableOnly: true, separatorBefore: true },
  { key: 'copy', flag: 'canCopy', editableOnly: false },
  { key: 'paste', flag: 'canPaste', editableOnly: true },
  { key: 'selectAll', flag: 'canSelectAll', editableOnly: false },
];

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

  sections.push(
    EDIT_ITEMS.filter((item) => !item.editableOnly || params.isEditable).flatMap(
      ({ key, flag, separatorBefore }): MenuItemConstructorOptions[] => [
        ...(separatorBefore ? [{ type: 'separator' } as const] : []),
        { label: labels[key], role: key, enabled: params.editFlags[flag] },
      ],
    ),
  );

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

type FileViewMenuState = Pick<FileViewMenuRequest, 'wrapLongLines' | 'fullFileDiff'>;

const FILE_VIEW_STATE: Record<FileViewMenuPick, keyof FileViewMenuState> = {
  wrapLongLines: 'wrapLongLines',
  fullFile: 'fullFileDiff',
};

export function buildFileViewMenuTemplate(
  state: FileViewMenuState,
  labels: ContextMenuLabels,
  onPick: (pick: FileViewMenuPick) => void,
): MenuItemConstructorOptions[] {
  return FileViewMenuPick.options.map((pick): MenuItemConstructorOptions => ({
    label: labels[pick],
    type: 'checkbox',
    checked: state[FILE_VIEW_STATE[pick]],
    click: () => onPick(pick),
  }));
}
