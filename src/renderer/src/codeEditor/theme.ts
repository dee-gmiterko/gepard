import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Theme } from '../theme/tokens';

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
    { tag: [tags.link, tags.url], color: theme.colors.accent, textDecoration: 'underline' },
    { tag: tags.monospace, color: s.string },
    { tag: tags.quote, color: s.comment, fontStyle: 'italic' },
    { tag: tags.list, color: s.keyword },
    { tag: [tags.processingInstruction, tags.contentSeparator], color: s.property },
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
      '.cm-url-link': {
        color: c.accent,
        textDecoration: 'underline',
        cursor: 'pointer',
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
      '.cm-selectionLayer': {
        zIndex: '150 !important',
        pointerEvents: 'none',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: `${c.bgSelected} !important`,
        opacity: '0.6',
      },
      '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
        backgroundColor: `${c.bgSelected} !important`,
      },
      '.cm-selectionMatch': {
        backgroundColor: c.bgSelected,
        outline: `1px solid ${c.border}`,
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
      '.cm-pipeline-gutter': {
        width: '1.4em',
      },
      '.cm-pipeline-marker': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
      },
      '.cm-pipeline-failure': { color: c.danger },
      '.cm-pipeline-warning': { color: c.warning },
      '.cm-pipeline-notice': { color: c.accent },
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
