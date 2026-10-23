import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]$/;

export function urlAt(lineText: string, offset: number): string | null {
  for (const m of lineText.matchAll(URL_PATTERN)) {
    const url = trimUrl(m[0]);
    if (offset >= m.index && offset <= m.index + url.length) return url;
  }
  return null;
}

const BRACKET_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}

// A closing bracket stays only when the URL holds a matching opener.
function trimUrl(raw: string): string {
  let url = raw;
  while (TRAILING_PUNCTUATION.test(url)) {
    const last = url[url.length - 1];
    const open = BRACKET_PAIRS[last];
    if (open !== undefined && count(url, open) >= count(url, last)) break;
    url = url.slice(0, -1);
  }
  return url;
}

const linkMark = Decoration.mark({ class: 'cm-url-link' });

const decorator = new MatchDecorator({
  regexp: URL_PATTERN,
  decorate(add, from, _to, match) {
    add(from, from + trimUrl(match[0]).length, linkMark);
  },
});

const linkDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = decorator.createDeco(view);
    }

    update(update: ViewUpdate): void {
      this.decorations = decorator.updateDeco(update, this.decorations);
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
        const line = view.state.doc.lineAt(pos);
        const url = urlAt(line.text, pos - line.from);
        if (url === null) return false;
        e.preventDefault();
        open(url);
        return true;
      },
    }),
  ];
}
