import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { ContextMenuLineTarget } from '@gepard/common';

export function lineContextMenu(
  path: string,
  setLineTarget: (target: ContextMenuLineTarget) => void,
  fileLineOf: (docLine: number) => number | null = (docLine) => docLine,
): Extension {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const line = fileLineOf(view.state.doc.lineAt(pos).number);
      if (line === null) return false;
      setLineTarget({ path, line });
      return false;
    },
  });
}
