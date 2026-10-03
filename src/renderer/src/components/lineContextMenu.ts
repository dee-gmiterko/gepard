import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { reportQueryError } from '../errors/report';
import { invoke } from '../ipc/client';

export function lineContextMenu(path: string): Extension {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      invoke('contextMenu.setLineTarget', { path, line: view.state.doc.lineAt(pos).number }).catch(
        (error: unknown) => reportQueryError('contextMenu.setLineTarget', error),
      );
      return false;
    },
  });
}
