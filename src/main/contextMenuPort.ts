import type { BrowserWindow } from 'electron';
import type {
  ContextMenuLabels,
  ContextMenuLineTarget,
  FileViewMenuPick,
  FileViewMenuRequest,
} from '@gepard/common';

export interface ContextMenuPort {
  setLabels(labels: ContextMenuLabels): void;
  setLineTarget(target: ContextMenuLineTarget): void;
  showFileView(
    window: BrowserWindow | null,
    request: FileViewMenuRequest,
  ): Promise<FileViewMenuPick | null>;
}

export class NoContextMenu implements ContextMenuPort {
  setLabels(): void {
    return;
  }

  setLineTarget(): void {
    return;
  }

  showFileView(): Promise<FileViewMenuPick | null> {
    return Promise.resolve(null);
  }
}
