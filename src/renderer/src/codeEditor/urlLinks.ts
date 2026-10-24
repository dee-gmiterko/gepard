import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>;

const WEB_URL = /^https?:\/\//;

function urlRange(state: EditorState, pos: number): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent) {
      const url = node.name === 'URL' ? node : node.name === 'Link' ? node.getChild('URL') : null;
      if (url && WEB_URL.test(state.sliceDoc(url.from, url.to))) return url;
    }
  }
  return null;
}

export function urlAt(state: EditorState, pos: number): string | null {
  const range = urlRange(state, pos);
  return range ? state.sliceDoc(range.from, range.to) : null;
}

const linkMark = Decoration.mark({ class: 'cm-url-link' });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'URL') return;
        if (WEB_URL.test(view.state.sliceDoc(node.from, node.to))) {
          builder.add(node.from, node.to, linkMark);
        }
      },
    });
  }
  return builder.finish();
}

const linkDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// The Electron main process routes window.open to the system browser.
export function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function urlLinks(open: (url: string) => void = openUrl): Extension {
  return [
    linkDecorations,
    EditorView.domEventHandlers({
      click: (e, view) => {
        if (e.button !== 0 || !view.state.selection.main.empty) return false;
        const target = e.target instanceof Element ? e.target : null;
        if (!target?.closest('.cm-url-link')) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return false;
        const url = urlAt(view.state, pos);
        if (url === null) return false;
        e.preventDefault();
        open(url);
        return true;
      },
    }),
  ];
}
