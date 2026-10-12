import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function revealDocLine(view: EditorView, docLineNumber: number): void {
  const clamped = Math.min(Math.max(docLineNumber, 1), view.state.doc.lines);
  const pos = view.state.doc.line(clamped).from;
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  });
}

export function revealDocRange(view: EditorView, from: number, to: number): void {
  const end = view.state.doc.length;
  const start = Math.min(Math.max(from, 0), end);
  view.dispatch({
    selection: EditorSelection.range(start, Math.min(Math.max(to, start), end)),
    effects: EditorView.scrollIntoView(start, { y: 'center' }),
  });
}
