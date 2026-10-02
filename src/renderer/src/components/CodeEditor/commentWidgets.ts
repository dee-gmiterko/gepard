import type { Text, Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, gutter } from '@codemirror/view';
import type { LineCommentEntry } from '../../helpers/comment';
import { AffordanceMarker } from './affordanceMarker';
import type { CommentPortals } from './commentPortals';
import { ThreadBlockWidget } from './threadBlockWidget';

export function commentBlockDecorations(
  doc: Text,
  entries: readonly LineCommentEntry[],
  portals: CommentPortals,
): Extension {
  const relevant = entries.filter((e) => e.threads.length > 0 || e.draft !== null);
  const sorted = [...relevant].sort((a, b) => a.docLine - b.docLine);
  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of sorted) {
    if (entry.docLine < 1 || entry.docLine > doc.lines) continue;
    const line = doc.line(entry.docLine);
    const widget = new ThreadBlockWidget(portals, entry);
    builder.add(line.to, line.to, Decoration.widget({ widget, block: true, side: 1 }));
  }
  return EditorView.decorations.of(builder.finish());
}

export function commentAffordanceGutter(
  isCommentable: (docLine: number) => boolean,
  onClick: (docLine: number) => void,
): Extension {
  return gutter({
    class: 'cm-comment-gutter',
    lineMarker: (view, line) => {
      const docLine = view.state.doc.lineAt(line.from).number;
      return isCommentable(docLine) ? new AffordanceMarker() : null;
    },
    initialSpacer: () => new AffordanceMarker(),
    domEventHandlers: {
      click: (view, line) => {
        const docLine = view.state.doc.lineAt(line.from).number;
        if (!isCommentable(docLine)) return false;
        onClick(docLine);
        return true;
      },
    },
  });
}
