import type { FileViewMenuPick } from '@gepard/common';
import type { ContextMenuPort } from '@gepard/main/contextMenuPort';

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
