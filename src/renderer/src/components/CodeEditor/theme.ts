import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Theme } from '../../theme/tokens';

function highlightStyle(theme: Theme): HighlightStyle {
  const s = theme.syntax;
  return HighlightStyle.define([
    { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: s.keyword },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: s.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: s.number },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: s.comment },
    { tag: [t.typeName, t.className, t.namespace], color: s.type },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: s.function },
    { tag: [t.propertyName, t.attributeName], color: s.property },
    { tag: [t.constant(t.variableName), t.standard(t.variableName)], color: s.constant },
    { tag: [t.tagName, t.heading], color: s.tag },
    { tag: t.heading, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.link, textDecoration: 'underline' },
    { tag: t.invalid, color: s.invalid },
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
        color: c.accent,
        cursor: 'pointer',
        opacity: 0,
      },
      '.cm-gutterElement:hover .cm-comment-affordance': {
        opacity: 1,
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
