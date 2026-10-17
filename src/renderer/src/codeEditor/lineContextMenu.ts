import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { reportQueryError } from '../errors/report';
import { setBrowserLineTarget } from '../contextMenu/menuStore';
import { invoke } from '../ipc/client';

export function lineContextMenu(
  path: string,
  fileLineOf: (docLine: number) => number | null = (docLine) => docLine,
): Extension {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const line = fileLineOf(view.state.doc.lineAt(pos).number);
      if (line === null) return false;
      if (window.gepard.host === 'browser') {
        setBrowserLineTarget({ path, line });
        return false;
      }
      invoke('contextMenu.setLineTarget', { path, line }).catch((error: unknown) =>
        reportQueryError('contextMenu.setLineTarget', error),
      );
      return false;
    },
  });
}
