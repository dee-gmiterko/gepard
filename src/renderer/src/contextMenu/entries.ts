import {
  FileViewMenuPick,
  type ContextMenuLabelKey,
  type ContextMenuLineTarget,
  type FileViewMenuRequest,
} from '@gepard/common';
import type { MenuEntry } from './menuStore';

export type Label = (key: ContextMenuLabelKey) => string;

export interface TextMenuContext {
  editable: boolean;
  hasSelection: boolean;
  target: ContextMenuLineTarget | null;
}

export interface TextMenuActions {
  edit: (command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll') => void;
  copyText: (text: string) => void;
}

export function formatLineReference(target: ContextMenuLineTarget): string {
  return `${target.path}:${target.line}`;
}

export function hasMenuContent(context: TextMenuContext): boolean {
  return context.editable || context.hasSelection || context.target !== null;
}

export function buildTextEntries(
  context: TextMenuContext,
  label: Label,
  actions: TextMenuActions,
): MenuEntry[] {
  const edit = (
    key: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll',
    disabled: boolean,
    separatorBefore = false,
  ): MenuEntry => ({
    label: label(key),
    disabled,
    separatorBefore,
    onSelect: () => actions.edit(key),
  });
  const entries: MenuEntry[] = [];
  if (context.editable) {
    entries.push(
      edit('undo', false),
      edit('redo', false),
      edit('cut', !context.hasSelection, true),
    );
  }
  entries.push(edit('copy', !context.hasSelection));
  if (context.editable) entries.push(edit('paste', false));
  entries.push(edit('selectAll', false));
  if (context.target !== null) {
    const { target } = context;
    entries.push(
      {
        label: label('copyFilePath'),
        separatorBefore: true,
        onSelect: () => actions.copyText(target.path),
      },
      {
        label: label('copyLineReference'),
        onSelect: () => actions.copyText(formatLineReference(target)),
      },
    );
  }
  return entries;
}

type FileViewMenuState = Pick<
  FileViewMenuRequest,
  'wrapLongLines' | 'fullFileDiff' | 'randomizeOrder' | 'incrementalDiff'
>;

const FILE_VIEW_STATE: Record<FileViewMenuPick, keyof FileViewMenuState> = {
  wrapLongLines: 'wrapLongLines',
  fullFile: 'fullFileDiff',
  randomizeOrder: 'randomizeOrder',
  incrementalDiff: 'incrementalDiff',
};

export function buildFileViewEntries(
  state: FileViewMenuState,
  label: Label,
  onPick: (pick: FileViewMenuPick) => void,
): MenuEntry[] {
  return FileViewMenuPick.options.map((pick) => ({
    label: label(pick),
    checked: state[FILE_VIEW_STATE[pick]],
    onSelect: () => onPick(pick),
  }));
}
