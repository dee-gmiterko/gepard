import { RangeSet, type Extension, type Range, type Text } from '@codemirror/state';
import { Decoration, EditorView, gutterLineClass, type GutterMarker } from '@codemirror/view';
import type { FullFileDiffMarks } from '../helpers/diff';
import { AddedLineGutterMarker } from './AddedLineGutterMarker';
import { DeletedLinesWidget } from './DeletedLinesWidget';

export function fullFileDiffDecorations(doc: Text, marks: FullFileDiffMarks): Extension {
  const decorations: Range<Decoration>[] = [];
  const gutterMarks: Range<GutterMarker>[] = [];
  const added = Decoration.line({ class: 'cm-line-add' });
  const addedGutter = new AddedLineGutterMarker();
  for (const [lineNo, deleted] of marks.deletedBefore) {
    const pastEnd = lineNo > doc.lines;
    const line = doc.line(Math.min(lineNo, doc.lines));
    const widget = Decoration.widget({
      widget: new DeletedLinesWidget(deleted),
      block: true,
      side: pastEnd ? 1 : -1,
    });
    decorations.push(widget.range(pastEnd ? line.to : line.from));
  }
  for (const lineNo of marks.addedLines) {
    if (lineNo > doc.lines) continue;
    const from = doc.line(lineNo).from;
    decorations.push(added.range(from));
    gutterMarks.push(addedGutter.range(from));
  }
  return [
    EditorView.decorations.of(Decoration.set(decorations, true)),
    gutterLineClass.of(RangeSet.of(gutterMarks, true)),
  ];
}
