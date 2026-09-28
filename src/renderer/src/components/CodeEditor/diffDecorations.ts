import { RangeSetBuilder, Text, type Extension } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter } from '@codemirror/view';
import type { DiffRow } from '@gepard/common/ipc/schemas/pr';

interface DiffLineInfo {
  kind: DiffRow['kind'];
  oldLine: number | null;
  newLine: number | null;
}

export function buildDiffDoc(rows: readonly DiffRow[]): { doc: Text; infos: DiffLineInfo[] } {
  const lines = rows.length > 0 ? rows.map((r) => r.text) : [''];
  const doc = Text.of(lines);
  const infos: DiffLineInfo[] = rows.map((r) => ({
    kind: r.kind,
    oldLine: r.oldLine,
    newLine: r.newLine,
  }));
  return { doc, infos };
}

const lineClass: Record<DiffRow['kind'], string | null> = {
  context: null,
  add: 'cm-line-add',
  delete: 'cm-line-delete',
  hunk: 'cm-line-hunk',
};

export function diffLineDecorations(doc: Text, infos: readonly DiffLineInfo[]): Extension {
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < infos.length; i++) {
    const cls = lineClass[infos[i].kind];
    if (!cls) continue;
    const line = doc.line(i + 1);
    builder.add(line.from, line.from, Decoration.line({ class: cls }));
  }
  return EditorView.decorations.of(builder.finish());
}

class DiffLineNumberMarker extends GutterMarker {
  constructor(private readonly label: string) {
    super();
  }
  eq(other: DiffLineNumberMarker): boolean {
    return other.label === this.label;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-diff-linenumber';
    span.textContent = this.label;
    return span;
  }
}

function lineInfoAt(
  view: EditorView,
  infos: readonly DiffLineInfo[],
  pos: number,
): DiffLineInfo | null {
  const lineNo = view.state.doc.lineAt(pos).number;
  return infos[lineNo - 1] ?? null;
}

export function diffGutters(infos: readonly DiffLineInfo[]): Extension[] {
  const oldGutter = gutter({
    class: 'cm-gutter-old',
    lineMarker: (view, line) => {
      const info = lineInfoAt(view, infos, line.from);
      return info?.oldLine != null ? new DiffLineNumberMarker(String(info.oldLine)) : null;
    },
    initialSpacer: () => new DiffLineNumberMarker('0000'),
  });
  const newGutter = gutter({
    class: 'cm-gutter-new',
    lineMarker: (view, line) => {
      const info = lineInfoAt(view, infos, line.from);
      return info?.newLine != null ? new DiffLineNumberMarker(String(info.newLine)) : null;
    },
    initialSpacer: () => new DiffLineNumberMarker('0000'),
  });
  return [oldGutter, newGutter];
}

export function findDiffDocLine(
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  line: number,
  side: 'LEFT' | 'RIGHT',
): number | null {
  const key = side === 'LEFT' ? 'oldLine' : 'newLine';
  const i = infos.findIndex((info) => info[key] === line);
  return i === -1 ? null : i + 1;
}
