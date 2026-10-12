import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function revealDocLine(view: EditorView, docLineNumber: number): void {
  const clamped = Math.min(Math.max(docLineNumber, 1), view.state.doc.lines);
  const line = view.state.doc.line(clamped);
  const pos = line.from;
  view.dispatch({
    selection: EditorSelection.range(line.from, line.to),
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
