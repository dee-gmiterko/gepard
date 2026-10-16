import type { BrowserWindow, WebContents } from 'electron';
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
import type { NotifyService } from './notify';
import type { NativeMenu } from './native';
import type { ContextMenuPort } from './contextMenuPort';

const TARGET_MAX_AGE_MS = 1000;

export class ContextMenuService implements ContextMenuPort {
  private labels: ContextMenuLabels | null = null;
  private pending: { target: ContextMenuLineTarget; at: number } | null = null;

  constructor(
    private readonly native: NativeMenu,
    private readonly notify: NotifyService,
  ) {}

  setLabels(next: ContextMenuLabels): void {
    this.labels = next;
  }

  setLineTarget(target: ContextMenuLineTarget): void {
    this.pending = { target, at: Date.now() };
  }

  install(webContents: WebContents): void {
    webContents.on('context-menu', (_event, params) => {
      const target = this.takeLineTarget();
      const { labels, native } = this;
      if (labels === null || !hasTextualContent(params, target)) return;
      const template = buildContextMenuTemplate(params, labels, target, {
        replaceMisspelling: (word) => webContents.replaceMisspelling(word),
        addToDictionary: (word) => {
          webContents.session.addWordToSpellCheckerDictionary(word);
        },
        copyText: (text) => {
          native
            .writeClipboard(text)
            .catch((err: unknown) =>
              this.notify.mainFailure(
                'contextMenu',
                `clipboard write failed: ${formatCaughtError(err)}`,
              ),
            );
        },
      });
      native.popupMenu(template);
    });
  }

  showFileView(
    window: BrowserWindow | null,
    request: FileViewMenuRequest,
  ): Promise<FileViewMenuPick | null> {
    const { labels, native } = this;
    if (labels === null || window === null) return Promise.resolve(null);
    return new Promise((resolve) => {
      const template = buildFileViewMenuTemplate(request, labels, resolve);
      native.popupMenu(template, {
        window,
        x: Math.round(request.x),
        y: Math.round(request.y),
        callback: () => setTimeout(() => resolve(null), 0),
      });
    });
  }

  private takeLineTarget(): ContextMenuLineTarget | null {
    const current = this.pending;
    this.pending = null;
    return current !== null && Date.now() - current.at <= TARGET_MAX_AGE_MS ? current.target : null;
  }
}
