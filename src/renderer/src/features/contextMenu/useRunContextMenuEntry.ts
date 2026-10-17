import { useCallback } from 'react';
import {
  FileViewMenuPick,
  TextMenuCommand,
  formatLineReference,
  type ContextMenuLabelKey,
  type ContextMenuRequest,
} from '@gepard/common';
import { runFileViewPick, useCommands } from '../../keyboard/useCommands';
import { reportQueryError } from '../../errors/report';

function copyText(text: string): void {
  navigator.clipboard
    .writeText(text)
    .catch((error: unknown) => reportQueryError('contextMenu.copyText', error));
}

function runTextCommand(command: TextMenuCommand): void {
  if (command !== 'paste') {
    document.execCommand(command);
    return;
  }
  navigator.clipboard
    .readText()
    .then((text) => document.execCommand('insertText', false, text))
    .catch((error: unknown) => reportQueryError('contextMenu.paste', error));
}

export function useRunContextMenuEntry(
  menu: ContextMenuRequest,
): (key: ContextMenuLabelKey) => void {
  const commands = useCommands();
  return useCallback(
    (key) => {
      if (menu.kind === 'fileView') {
        runFileViewPick(commands, FileViewMenuPick.parse(key));
        return;
      }
      if (key === 'copyFilePath') {
        if (menu.target) copyText(menu.target.path);
      } else if (key === 'copyLineReference') {
        if (menu.target) copyText(formatLineReference(menu.target));
      } else {
        runTextCommand(TextMenuCommand.parse(key));
      }
    },
    [menu, commands],
  );
}
