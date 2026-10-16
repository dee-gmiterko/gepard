import type {
  ContextMenuLabels,
  ContextMenuLineTarget,
  FileViewMenuPick,
  FileViewMenuRequest,
} from '@gepard/common';
import type { WindowHandle } from './native';

export interface ContextMenuPort {
  setLabels(labels: ContextMenuLabels): void;
  setLineTarget(target: ContextMenuLineTarget): void;
  showFileView(
    window: WindowHandle | null,
    request: FileViewMenuRequest,
  ): Promise<FileViewMenuPick | null>;
}
