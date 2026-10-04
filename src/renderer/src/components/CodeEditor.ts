import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { useTheme } from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  RangeSet,
  RangeSetBuilder,
  type Range,
  Text,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  drawSelection,
  gutter,
  gutterLineClass,
  highlightActiveLine,
  highlightActiveLineGutter,
  hoverTooltip,
  keymap,
  type GutterMarker,
  type Tooltip,
} from '@codemirror/view';
import {
  HighlightStyle,
  Language,
  LanguageDescription,
  LanguageSupport,
  LRLanguage,
  StreamLanguage,
  bracketMatching,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language';
import { languages as builtinLanguages } from '@codemirror/language-data';
import { styleTags, tags } from '@lezer/highlight';
import { LRParser } from '@lezer/lr';
import {
  isGrammarExtension,
  type DefinitionResult,
  type DiffRow,
  type GrammarApi,
  type GrammarExtension,
  type GrammarModule,
} from '@gepard/common';
import { reportError } from '../errors/report';
import { escapeRegExp } from '../helpers/string';
import type { LineCommentEntry } from '../helpers/comment';
import { useCommands, type Commands } from '../keyboard/useCommands';
import { useGrammars } from '../queries/grammars';
import type { Theme } from '../theme/tokens';
import type { FullFileDiffMarks } from '../helpers/diff';
import { AddedLineGutterMarker } from './AddedLineGutterMarker';
import { AffordanceMarker } from './AffordanceMarker';
import { DeletedLinesWidget } from './DeletedLinesWidget';
import type { CommentPortals } from './CommentPortals';
import { DiffLineNumberMarker } from './DiffLineNumberMarker';
import type { SymbolPortals } from './SymbolPortals';
import { ThreadBlockWidget } from './ThreadBlockWidget';

export interface ActiveEditor {
  view: EditorView;
  doc: Text;
}

// Only one file viewer is mounted at a time, so the latest loaded editor is the active file's.
let current: ActiveEditor | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function getActiveEditor(): ActiveEditor | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const activeEditor = {
  set(view: EditorView): void {
    current = { view, doc: view.state.doc };
    notify();
  },
  clear(view: EditorView): void {
    if (current?.view !== view) return;
    current = null;
    notify();
  },
};

export function useActiveEditor(): ActiveEditor | null {
  return useSyncExternalStore(subscribe, getActiveEditor);
}

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

// CodeMirror handles keys in its contentEditable before they reach a window
// keydown listener.

export function keymapBridge(getCommands: () => Commands): Extension {
  return Prec.high(
    keymap.of([
      {
        key: 'Space',
        run: () => {
          getCommands().toggleViewed();
          return true;
        },
      },
      {
        key: 'PageUp',
        run: () => {
          getCommands().prevFile();
          return true;
        },
      },
      {
        key: 'PageDown',
        run: () => {
          getCommands().nextFile();
          return true;
        },
      },
      {
        key: 'End',
        run: () => {
          getCommands().acceptNext();
          return true;
        },
      },
      {
        key: 'Home',
        run: () => {
          getCommands().revertPrev();
          return true;
        },
      },
    ]),
  );
}

export const grammarApi: GrammarApi = {
  StreamLanguage,
  LRLanguage,
  LanguageSupport,
  styleTags,
  tags,
  LRParser,
};

export type GrammarModuleLoader = (source: string) => Promise<GrammarExtension>;

const moduleCache = new Map<string, Promise<GrammarExtension>>();

export function loadGrammarModule(source: string): Promise<GrammarExtension> {
  let loaded = moduleCache.get(source);
  if (!loaded) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    loaded = import(/* @vite-ignore */ url)
      .then((mod: { default?: unknown }) => {
        const candidate = mod.default;
        if (!isGrammarExtension(candidate)) {
          throw new Error('grammar module has no valid default export');
        }
        return candidate;
      })
      .finally(() => URL.revokeObjectURL(url));
    moduleCache.set(source, loaded);
    loaded.catch(() => moduleCache.delete(source));
  }
  return loaded;
}

export function grammarLanguageDescriptions(
  grammars: readonly GrammarModule[],
  load: GrammarModuleLoader = loadGrammarModule,
): LanguageDescription[] {
  return grammars.flatMap((grammar) =>
    grammar.languages.map((language) =>
      LanguageDescription.of({
        name: language.name,
        extensions: language.extensions,
        filename: language.filenames?.length
          ? new RegExp(`(^|/)(${language.filenames.map(escapeRegExp).join('|')})$`)
          : undefined,
        async load() {
          const mod = await load(grammar.source);
          const support = mod.support(grammarApi, language.name);
          if (support instanceof LanguageSupport) return support;
          if (support instanceof Language) return new LanguageSupport(support);
          throw new Error(`grammar "${grammar.id}" returned no language for "${language.name}"`);
        },
      }),
    ),
  );
}

export function allLanguageDescriptions(
  grammars: readonly GrammarModule[],
  load?: GrammarModuleLoader,
): LanguageDescription[] {
  return [...grammarLanguageDescriptions(grammars, load), ...builtinLanguages];
}

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

export function readOnlyExtensions(): Extension {
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ tabindex: '0' }),
    drawSelection(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    bracketMatching(),
  ];
}

export interface HoveredSymbol {
  name: string;
  from: number;
  to: number;
  line: number;
  col: number;
}

export interface SymbolPopupEntry {
  symbol: HoveredSymbol;
  definitions: DefinitionResult['definitions'];
}

export interface SymbolPortal {
  key: number;
  dom: HTMLElement;
  entry: SymbolPopupEntry;
}

const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

export function hoveredSymbol(state: EditorState, pos: number, side: -1 | 1): HoveredSymbol | null {
  const word = state.wordAt(pos);
  if (!word || (side < 0 ? pos <= word.from : pos >= word.to)) return null;
  const name = state.sliceDoc(word.from, word.to);
  if (!IDENTIFIER.test(name)) return null;
  if (/Comment|String/.test(syntaxTree(state).resolveInner(pos, side).name)) return null;
  const line = state.doc.lineAt(word.from);
  return { name, from: word.from, to: word.to, line: line.number, col: word.from - line.from + 1 };
}

export type SymbolResolver = (symbol: HoveredSymbol) => Promise<DefinitionResult['definitions']>;

export function symbolTooltip(portals: SymbolPortals): Extension {
  return hoverTooltip(
    async (view, pos, side): Promise<Tooltip | null> => {
      const symbol = hoveredSymbol(view.state, pos, side);
      if (!symbol) return null;
      const definitions = await portals.resolve(symbol);
      if (definitions.length === 0) return null;
      return {
        pos: symbol.from,
        end: symbol.to,
        create: () => {
          const dom = document.createElement('div');
          dom.className = 'cm-symbol-popup';
          portals.set(dom, { symbol, definitions });
          return { dom, destroy: () => portals.remove(dom) };
        },
      };
    },
    { hoverTime: 350, hideOnChange: true },
  );
}

function highlightStyle(theme: Theme): HighlightStyle {
  const s = theme.syntax;
  return HighlightStyle.define([
    {
      tag: [tags.keyword, tags.modifier, tags.operatorKeyword, tags.controlKeyword],
      color: s.keyword,
    },
    { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character], color: s.string },
    { tag: [tags.number, tags.bool, tags.null, tags.atom], color: s.number },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: s.comment },
    { tag: [tags.typeName, tags.className, tags.namespace], color: s.type },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: s.function,
    },
    { tag: [tags.propertyName, tags.attributeName], color: s.property },
    {
      tag: [tags.constant(tags.variableName), tags.standard(tags.variableName)],
      color: s.constant,
    },
    { tag: [tags.tagName, tags.heading], color: s.tag },
    { tag: tags.heading, fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.link, textDecoration: 'underline' },
    { tag: tags.invalid, color: s.invalid },
  ]);
}

export function editorTheme(theme: Theme): Extension {
  const c = theme.colors;
  const view = EditorView.theme(
    {
      '&': {
        color: c.fg,
        backgroundColor: c.bg,
        fontSize: theme.font.size.md,
      },
      '.cm-scroller': {
        fontFamily: theme.font.mono,
        lineHeight: String(theme.font.lineHeight),
      },
      '.cm-content': {
        caretColor: c.fg,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: c.fg,
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: `${c.bgSelected} !important`,
      },
      '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
        backgroundColor: `${c.bgSelected} !important`,
      },
      '.cm-gutters': {
        backgroundColor: c.bgSubtle,
        color: c.fgSubtle,
        border: 'none',
        borderRight: `1px solid ${c.border}`,
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 6px',
      },
      '.cm-activeLine': {
        backgroundColor: c.bgHover,
      },
      '.cm-activeLineGutter': {
        backgroundColor: c.bgHover,
      },
      '.cm-line-add': {
        backgroundColor: c.diffAddBg,
        color: c.diffAddFg,
      },
      '.cm-line-delete': {
        backgroundColor: c.diffDelBg,
        color: c.diffDelFg,
      },
      '.cm-deleted-line': {
        padding: '0 2px 0 6px',
        whiteSpace: 'pre',
        backgroundColor: c.diffDelBg,
        color: c.diffDelFg,
      },
      '.cm-gutter-line-add': {
        backgroundColor: c.diffAddBg,
      },
      '.cm-line-hunk': {
        backgroundColor: c.diffHunk,
        color: c.fgMuted,
      },
      '.cm-gutter-old, .cm-gutter-new': {
        color: c.fgSubtle,
        fontSize: theme.font.size.xs,
      },
      '.cm-diff-linenumber': {
        display: 'inline-block',
        minWidth: '3.5em',
        padding: '0 6px',
        textAlign: 'right',
      },
      '.cm-comment-gutter': {
        width: '1.4em',
      },
      '.cm-comment-affordance': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: 0,
        border: 'none',
        background: 'none',
        color: c.accent,
        cursor: 'pointer',
        opacity: 0,
      },
      '.cm-gutterElement:hover .cm-comment-affordance, .cm-comment-affordance:focus-visible': {
        opacity: 1,
      },
      '.cm-tooltip': {
        border: `1px solid ${c.border}`,
        borderRadius: theme.radius.md,
        backgroundColor: c.bgElevated,
        color: c.fg,
        boxShadow: theme.shadow.popover,
        fontFamily: theme.font.ui,
        fontSize: theme.font.size.sm,
      },
      '.cm-comment-widget': {
        backgroundColor: c.commentBg,
        borderTop: `1px solid ${c.border}`,
        borderBottom: `1px solid ${c.border}`,
        padding: `${theme.space[2]} ${theme.space[3]}`,
        // The editor content sets `white-space: pre` for code lines; reset it
        // here so comment text wraps instead of overflowing the scroller.
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      },
    },
    { dark: theme.mode === 'dark' },
  );
  return [view, syntaxHighlighting(highlightStyle(theme))];
}

const messages = defineMessages({
  syntaxHighlightingFailed: {
    id: 'codeEditor.syntaxHighlightingFailed',
    defaultMessage: 'Syntax highlighting for {path} failed to load; showing plain text.',
  },
});

interface ReadOnlyEditor {
  containerRef: RefObject<HTMLDivElement | null>;
  view: EditorView | null;
  comments: Compartment;
  commentGutter: Compartment;
}

export function useReadOnlyEditor(
  path: string,
  doc: string | Text,
  extensions: Extension,
): ReadOnlyEditor {
  const theme = useTheme();
  const commands = useCommands();
  const commandsRef = useRef(commands);
  useLayoutEffect(() => {
    commandsRef.current = commands;
  });
  const intl = useIntl();
  const intlRef = useRef(intl);
  useLayoutEffect(() => {
    intlRef.current = intl;
  });

  const { data: grammars } = useGrammars();
  const languages = useMemo(() => allLanguageDescriptions(grammars ?? []), [grammars]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const compartments = useMemo(
    () => ({
      theme: new Compartment(),
      language: new Compartment(),
      extensions: new Compartment(),
      comments: new Compartment(),
      commentGutter: new Compartment(),
    }),
    [],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const newView = new EditorView({
      state: EditorState.create({
        extensions: [
          readOnlyExtensions(),
          compartments.extensions.of([]),
          compartments.theme.of([]),
          compartments.language.of([]),
          compartments.comments.of([]),
          compartments.commentGutter.of([]),
          keymapBridge(() => commandsRef.current),
        ],
      }),
      parent: el,
    });
    setView(newView);

    return () => {
      activeEditor.clear(newView);
      newView.destroy();
      setView(null);
    };
  }, [compartments]);

  useEffect(() => {
    if (!view) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: doc },
      effects: [
        compartments.extensions.reconfigure(extensions),
        compartments.theme.reconfigure(editorTheme(theme)),
      ],
    });
    activeEditor.set(view);

    let cancelled = false;
    const desc = LanguageDescription.matchFilename(languages, path);
    if (desc) {
      desc.load().then(
        (support) => {
          if (!cancelled) view.dispatch({ effects: compartments.language.reconfigure(support) });
        },
        (e: Error) =>
          reportError({
            scope: 'language-support',
            message: intlRef.current.formatMessage(messages.syntaxHighlightingFailed, { path }),
            tone: 'warning',
            detail: e.stack ?? e.message,
          }),
      );
    } else {
      view.dispatch({ effects: compartments.language.reconfigure([]) });
    }

    return () => {
      cancelled = true;
    };
  }, [path, doc, extensions, theme, view, compartments, languages]);

  return {
    containerRef,
    view,
    comments: compartments.comments,
    commentGutter: compartments.commentGutter,
  };
}
