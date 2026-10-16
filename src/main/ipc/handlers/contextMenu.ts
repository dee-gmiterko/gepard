import type { HandlerMap } from '../dispatch';
import type { ContextMenuPort } from '../../ports/contextMenuPort';

export class ContextMenuHandlers {
  constructor(private readonly contextMenu: ContextMenuPort) {}

  toHandlerMap(): Pick<
    HandlerMap,
    'contextMenu.setLabels' | 'contextMenu.setLineTarget' | 'contextMenu.showFileView'
  > {
    return {
      'contextMenu.setLabels': (labels) => this.contextMenu.setLabels(labels),
      'contextMenu.setLineTarget': (target) => this.contextMenu.setLineTarget(target),
      'contextMenu.showFileView': (request, { window }) =>
        this.contextMenu.showFileView(window, request),
    };
  }
}
