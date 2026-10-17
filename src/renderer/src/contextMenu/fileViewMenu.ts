import type { FileViewMenuPick, FileViewMenuRequest } from '@gepard/common';
import { invoke } from '../ipc/client';
import { buildFileViewEntries, type Label } from './entries';
import { openMenu } from './menuStore';

export function showFileViewMenu(
  request: FileViewMenuRequest,
  label: Label,
): Promise<FileViewMenuPick | null> {
  if (window.gepard.host === 'desktop') return invoke('contextMenu.showFileView', request);
  return new Promise((resolve) => {
    let picked = false;
    openMenu({
      x: request.x,
      y: request.y,
      entries: buildFileViewEntries(request, label, (pick) => {
        picked = true;
        resolve(pick);
      }),
      onClose: () => {
        if (!picked) resolve(null);
      },
    });
  });
}
