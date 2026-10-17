import {
  FILE_VIEW_MENU_STATE,
  FileViewMenuPick,
  type ContextMenuLabelKey,
  type ContextMenuRequest,
  type TextMenuRequest,
} from '@gepard/common';

export interface ContextMenuEntry {
  key: ContextMenuLabelKey;
  checked?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function hasTextMenuContent({ editable, hasSelection, target }: TextMenuRequest): boolean {
  return editable || hasSelection || target !== null;
}

function textEntries({ editable, hasSelection, target }: TextMenuRequest): ContextMenuEntry[] {
  const editing: ContextMenuEntry[] = editable
    ? [
        { key: 'undo' },
        { key: 'redo' },
        { key: 'cut', disabled: !hasSelection, separatorBefore: true },
      ]
    : [];
  const paste: ContextMenuEntry[] = editable ? [{ key: 'paste' }] : [];
  const line: ContextMenuEntry[] =
    target === null
      ? []
      : [{ key: 'copyFilePath', separatorBefore: true }, { key: 'copyLineReference' }];
  return [
    ...editing,
    { key: 'copy', disabled: !hasSelection },
    ...paste,
    { key: 'selectAll' },
    ...line,
  ];
}

export function contextMenuEntries(menu: ContextMenuRequest): ContextMenuEntry[] {
  if (menu.kind === 'text') return textEntries(menu);
  return FileViewMenuPick.options.map((pick) => ({
    key: pick,
    checked: menu[FILE_VIEW_MENU_STATE[pick]],
  }));
}
