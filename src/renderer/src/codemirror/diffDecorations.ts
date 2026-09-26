// Combined single-document diff model (report 02 decision): one CodeMirror
// document built from `DiffRow[]`, dual old/new line-number gutters, and
// add/del/hunk line decorations from theme tokens (applied via CSS classes
// set up in codemirror/theme.ts, not raw colors here). No `@codemirror/merge`.
import { RangeSetBuilder, Text, type Extension } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, gutter } from '@codemirror/view'
import type { DiffRow } from '@shared/ipc/schemas/pr'

/** Per-document-line (1-based, matching `Text.line`) view of a `DiffRow`,
 * kept separate from the row list itself so lookups are by line number. */
export interface DiffLineInfo {
  kind: DiffRow['kind']
  oldLine: number | null
  newLine: number | null
}

/** Builds the document text and the per-line info the gutters/decorations
 * and comment-anchor mapping (codemirror/commentWidgets.tsx) key off. */
export function buildDiffDoc(rows: readonly DiffRow[]): { doc: Text; infos: DiffLineInfo[] } {
  const lines = rows.length > 0 ? rows.map((r) => r.text) : ['']
  const doc = Text.of(lines)
  const infos: DiffLineInfo[] = rows.map((r) => ({
    kind: r.kind,
    oldLine: r.oldLine,
    newLine: r.newLine
  }))
  return { doc, infos }
}

const lineClass: Record<DiffRow['kind'], string | null> = {
  context: null,
  add: 'cm-line-add',
  delete: 'cm-line-delete',
  hunk: 'cm-line-hunk'
}

/** ctx/add/del/hunk line background from theme tokens (spec Styling: theme
 * tokens only), as CSS classes resolved in codemirror/theme.ts. */
export function diffLineDecorations(doc: Text, infos: readonly DiffLineInfo[]): Extension {
  const builder = new RangeSetBuilder<Decoration>()
  for (let i = 0; i < infos.length; i++) {
    const cls = lineClass[infos[i].kind]
    if (!cls) continue
    const line = doc.line(i + 1)
    builder.add(line.from, line.from, Decoration.line({ class: cls }))
  }
  return EditorView.decorations.of(builder.finish())
}

class DiffLineNumberMarker extends GutterMarker {
  constructor(private readonly label: string) {
    super()
  }
  eq(other: DiffLineNumberMarker): boolean {
    return other.label === this.label
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-diff-linenumber'
    span.textContent = this.label
    return span
  }
}

function lineInfoAt(
  view: EditorView,
  infos: readonly DiffLineInfo[],
  pos: number
): DiffLineInfo | null {
  const lineNo = view.state.doc.lineAt(pos).number
  return infos[lineNo - 1] ?? null
}

/** Dual old/new line-number gutters (report 02 decision), replacing the
 * plain `lineNumbers()` gutter the code viewer uses. */
export function diffGutters(infos: readonly DiffLineInfo[]): Extension[] {
  const oldGutter = gutter({
    class: 'cm-gutter-old',
    lineMarker: (view, line) => {
      const info = lineInfoAt(view, infos, line.from)
      return info?.oldLine != null ? new DiffLineNumberMarker(String(info.oldLine)) : null
    },
    initialSpacer: () => new DiffLineNumberMarker('0000')
  })
  const newGutter = gutter({
    class: 'cm-gutter-new',
    lineMarker: (view, line) => {
      const info = lineInfoAt(view, infos, line.from)
      return info?.newLine != null ? new DiffLineNumberMarker(String(info.newLine)) : null
    },
    initialSpacer: () => new DiffLineNumberMarker('0000')
  })
  return [oldGutter, newGutter]
}
