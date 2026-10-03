import type { HandlerMap } from '../registry';
import { setContextMenuLabels, setContextMenuLineTarget } from '../../contextMenu';

export const contextMenuHandlers: Pick<
  HandlerMap,
  'contextMenu.setLabels' | 'contextMenu.setLineTarget'
> = {
  'contextMenu.setLabels': (labels) => setContextMenuLabels(labels),
  'contextMenu.setLineTarget': (target) => setContextMenuLineTarget(target),
};
