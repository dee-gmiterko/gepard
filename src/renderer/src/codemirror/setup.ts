// Read-only CodeMirror setup shared by the code and diff viewers (spec: "@codemirror
// editor for code and diff view (read only)"). Language highlighting and the
// diff-specific gutters/decorations are added separately by each viewer
// (codemirror/theme.ts, codemirror/diffDecorations.ts, codemirror/commentWidgets.tsx).
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter
} from '@codemirror/view'
import { bracketMatching } from '@codemirror/language'

/** Common to both the code viewer and the diff viewer: no editing, no cursor
 * blinking side effects beyond selection/copy, active-line highlight for
 * orientation while scrolling a large file. */
export function readOnlyExtensions(): Extension {
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ tabindex: '0' }),
    drawSelection(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    bracketMatching()
  ]
}
