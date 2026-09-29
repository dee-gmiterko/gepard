import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTheme } from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import { Compartment, EditorState, type Extension, type Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { useCommands } from '../../keyboard/useCommands';
import { readOnlyExtensions } from './setup';
import { editorTheme } from './theme';
import { keymapBridge } from './keymapBridge';
import { reportError } from '../../errors/report';

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
  }, [path, doc, extensions, theme, view, compartments]);

  return {
    containerRef,
    view,
    comments: compartments.comments,
    commentGutter: compartments.commentGutter,
  };
}
