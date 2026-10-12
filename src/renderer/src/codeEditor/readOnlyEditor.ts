import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTheme } from 'styled-components';
import { defineMessages, useIntl } from 'react-intl';
import { Compartment, EditorState, type Extension, type Text } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { LanguageDescription, bracketMatching } from '@codemirror/language';
import { reportError } from '../errors/report';
import { useCommands } from '../keyboard/useCommands';
import { useGrammars } from '../queries/grammars';
import { useKeybindingOverrides } from '../queries/keybindings';
import { activeEditor } from './activeEditor';
import { allLanguageDescriptions } from './grammar';
import { keymapBridge } from './keymapBridge';
import { editorTheme } from './theme';

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
  const intl = useIntl();
  const intlRef = useRef(intl);
  useLayoutEffect(() => {
    intlRef.current = intl;
  });

  const { data: keybindingOverrides } = useKeybindingOverrides();
  const overridesRef = useRef(keybindingOverrides);
  useLayoutEffect(() => {
    overridesRef.current = keybindingOverrides;
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
          keymapBridge(
            () => commands,
            () => overridesRef.current,
          ),
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
  }, [compartments, commands]);

  useEffect(() => {
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
    activeEditor.set(view);
  }, [view, doc]);

  useEffect(() => {
    if (!view) return;
    view.dispatch({ effects: compartments.extensions.reconfigure(extensions) });
  }, [view, compartments, extensions]);

  useEffect(() => {
    if (!view) return;
    view.dispatch({ effects: compartments.theme.reconfigure(editorTheme(theme)) });
  }, [view, compartments, theme]);

  useEffect(() => {
    if (!view) return;
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
  }, [view, compartments, languages, path]);

  return {
    containerRef,
    view,
    comments: compartments.comments,
    commentGutter: compartments.commentGutter,
  };
}
