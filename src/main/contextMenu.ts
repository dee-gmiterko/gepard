import { clipboard, Menu, type BrowserWindow, type WebContents } from 'electron';
import type {
  ContextMenuLabels,
  ContextMenuLineTarget,
  FileViewMenuPick,
  FileViewMenuRequest,
} from '@gepard/common';
import {
  buildContextMenuTemplate,
  buildFileViewMenuTemplate,
  hasTextualContent,
} from './helpers/contextMenu';
import { formatCaughtError } from './helpers/error';
import { notifyMainFailure } from './notify';

// The renderer announces the clicked line just before the native event fires.
const TARGET_MAX_AGE_MS = 1000;

let labels: ContextMenuLabels | null = null;
let pending: { target: ContextMenuLineTarget; at: number } | null = null;

export function setContextMenuLabels(next: ContextMenuLabels): void {
  labels = next;
}

export function setContextMenuLineTarget(target: ContextMenuLineTarget): void {
  pending = { target, at: Date.now() };
}

function takeLineTarget(): ContextMenuLineTarget | null {
  const current = pending;
  pending = null;
  return current !== null && Date.now() - current.at <= TARGET_MAX_AGE_MS ? current.target : null;
}

export function installContextMenu(webContents: WebContents): void {
  webContents.on('context-menu', (_event, params) => {
    const target = takeLineTarget();
    if (labels === null || !hasTextualContent(params, target)) return;
    const template = buildContextMenuTemplate(params, labels, target, {
      replaceMisspelling: (word) => webContents.replaceMisspelling(word),
      addToDictionary: (word) => {
        webContents.session.addWordToSpellCheckerDictionary(word);
      },
      copyText: (text) => {
        clipboard
          .writeText(text)
          .catch((err: unknown) =>
            notifyMainFailure('contextMenu', `clipboard write failed: ${formatCaughtError(err)}`),
          );
      },
    });
    Menu.buildFromTemplate(template).popup();
  });
}

export function showFileViewMenu(
  window: BrowserWindow | null,
  request: FileViewMenuRequest,
): Promise<FileViewMenuPick | null> {
  if (labels === null || window === null) return Promise.resolve(null);
  const current = labels;
  return new Promise((resolve) => {
    const template = buildFileViewMenuTemplate(request, current, resolve);
    Menu.buildFromTemplate(template).popup({
      window,
      x: Math.round(request.x),
      y: Math.round(request.y),
      callback: () => setTimeout(() => resolve(null), 0),
    });
  });
}
