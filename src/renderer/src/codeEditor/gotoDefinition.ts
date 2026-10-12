import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { hoveredSymbol, type HoveredSymbol } from './symbols';

export interface GotoHandlers {
  resolveImport: (spec: string) => Promise<string | null>;
  openFile: (path: string, view: EditorView) => void;
  openSymbol: (symbol: HoveredSymbol, view: EditorView) => void;
}

// Handlers are swapped from an effect so the CodeMirror extension itself can stay stable.
export class GotoTarget {
  private handlers: GotoHandlers | null = null;

  set(handlers: GotoHandlers): void {
    this.handlers = handlers;
  }

  get(): GotoHandlers | null {
    return this.handlers;
  }
}

const QUOTED = /(["'`])((?:\\.|(?!\1).)*)\1/g;

export function quotedAt(lineText: string, offset: number): string | null {
  for (const m of lineText.matchAll(QUOTED)) {
    const start = m.index;
    if (offset > start && offset < start + m[0].length - 1) return m[2];
  }
  return null;
}

export function gotoDefinition(target: GotoTarget): Extension {
  return EditorView.domEventHandlers({
    mousedown: (e, view) => {
      if (e.button !== 0 || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return false;
      const handlers = target.get();
      if (!handlers) return false;
      const line = view.state.doc.lineAt(pos);
      const spec = quotedAt(line.text, pos - line.from);
      const symbol = hoveredSymbol(view.state, pos, 1) ?? hoveredSymbol(view.state, pos, -1);
      if (spec === null && !symbol) return false;
      e.preventDefault();
      if (spec === null) {
        if (symbol) handlers.openSymbol(symbol, view);
        return true;
      }
      void handlers.resolveImport(spec).then(
        (file) => {
          if (file !== null) handlers.openFile(file, view);
          else if (symbol) handlers.openSymbol(symbol, view);
        },
        () => {
          if (symbol) handlers.openSymbol(symbol, view);
        },
      );
      return true;
    },
  });
}
