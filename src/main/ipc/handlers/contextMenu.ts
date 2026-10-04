import type { HandlerMap } from '../registry';
import {
  setContextMenuLabels,
  setContextMenuLineTarget,
  showFileViewMenu,
} from '../../contextMenu';

export const contextMenuHandlers: Pick<
  HandlerMap,
  'contextMenu.setLabels' | 'contextMenu.setLineTarget' | 'contextMenu.showFileView'
> = {
  'contextMenu.setLabels': (labels) => setContextMenuLabels(labels),
  'contextMenu.setLineTarget': (target) => setContextMenuLineTarget(target),
  'contextMenu.showFileView': (request, { window }) => showFileViewMenu(window, request),
};
