import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { useAppDispatch, useAppState } from '../../state/AppContext';
import type { QuickSearchMode } from '../../state/reducer';
import { useTargetedFiles, useTree } from '../../queries/files';
import { useWorkspaceSymbols } from '../../queries/search';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useActiveEditor } from '../../components/CodeEditor/activeEditor';
import { revealDocRange } from '../../components/CodeEditor/revealLine';
import { Surface } from '../../components/Surface';
import { TextInput } from '../../components/TextInput';
import { HighlightedText } from '../../components/HighlightedText';
import { PathLabel } from '../../components/PathLabel';
import { Caption } from '../../components/Caption';
import { Message } from '../../components/Message';
import { listReset } from '../../components/List';
import { findBestMatch, foldCase, nextMatch, type TextMatch } from '../../helpers/match';
import { rankNavigation, type NavigationMatch } from '../../helpers/navigation';
import { definitionKinds, type WorkspaceSymbol } from '@gepard/common';

type SymbolKind = WorkspaceSymbol['kind'];

const SYMBOL_POOL = 40;
const DEFINITION_KINDS: SymbolKind[] = [...definitionKinds];

const messages = defineMessages({
  dialog: {
    id: 'quickSearch.dialog',
    defaultMessage: 'Quick search',
  },
  findPlaceholder: {
    id: 'quickSearch.find.placeholder',
    defaultMessage: 'Find in file…',
  },
  findNoEditor: {
    id: 'quickSearch.find.noEditor',
    defaultMessage: 'No text file is open.',
  },
  findHint: {
    id: 'quickSearch.find.hint',
    defaultMessage: 'Enter: next match, Shift+Enter: previous, Esc: close.',
  },
  findLine: {
    id: 'quickSearch.find.line',
    defaultMessage: 'Line {line}',
  },
  navigatePlaceholder: {
    id: 'quickSearch.navigate.placeholder',
    defaultMessage: 'Go to file or symbol…',
  },
  navigateHint: {
    id: 'quickSearch.navigate.hint',
    defaultMessage: 'Type to search file paths and type definitions.',
  },
  navigateResults: {
    id: 'quickSearch.navigate.results',
    defaultMessage: 'Files and symbols',
  },
  searchingSymbols: {
    id: 'quickSearch.navigate.searchingSymbols',
    defaultMessage: 'Searching symbols…',
  },
  noMatches: {
    id: 'quickSearch.noMatches',
    defaultMessage: 'No matches.',
  },
  kindNamespace: { id: 'quickSearch.symbolKind.namespace', defaultMessage: 'namespace' },
  kindClass: { id: 'quickSearch.symbolKind.class', defaultMessage: 'class' },
  kindInterface: { id: 'quickSearch.symbolKind.interface', defaultMessage: 'interface' },
  kindEnum: { id: 'quickSearch.symbolKind.enum', defaultMessage: 'enum' },
  kindType: { id: 'quickSearch.symbolKind.type', defaultMessage: 'type' },
});

const kindMessages: Partial<Record<SymbolKind, MessageDescriptor>> = {
  namespace: messages.kindNamespace,
  class: messages.kindClass,
  interface: messages.kindInterface,
  enum: messages.kindEnum,
  type: messages.kindType,
};

const Popup = styled(Surface).attrs({ $elevation: 'floating' as const })`
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${({ theme }) => theme.z.popover};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  width: 560px;
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
  padding: ${({ theme }) => theme.space[2]};
`;

const Status = styled(Caption)`
  padding: 0 ${({ theme }) => theme.space[1]};
`;

const Options = styled.ul`
  ${listReset}
`;

const Option = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
  padding: 6px ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ $active, theme }) => ($active ? theme.colors.bgHover : 'transparent')};
  cursor: pointer;
`;

const SymbolName = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.fg};
`;

const FilePath = styled(PathLabel)`
  flex: 0 1 auto;
`;

export function QuickSearch(): React.JSX.Element | null {
  const mode = useAppState().quickSearch;
  if (mode === null) return null;
  return <QuickSearchPopup key={mode} mode={mode} />;
}

function QuickSearchPopup({ mode }: { mode: QuickSearchMode }): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const popupRef = useRef<HTMLDivElement>(null);
  const close = (): void => dispatch({ type: 'quickSearch/close' });
  useOutsideClick(popupRef, close);

  return (
    <Popup ref={popupRef} role="dialog" aria-label={intl.formatMessage(messages.dialog)}>
      {mode === 'file' ? <FindInFile onClose={close} /> : <Navigate onClose={close} />}
    </Popup>
  );
}

function useAutoFocus(): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function FindInFile({ onClose }: { onClose: () => void }): React.JSX.Element {
  const intl = useIntl();
  const inputRef = useAutoFocus();
  const editor = useActiveEditor();
  const [text, setText] = useState('');
  const [anchor] = useState(() => editor?.view.state.selection.main.from ?? 0);
  const [stepped, setStepped] = useState<TextMatch | null>(null);

  const doc = useMemo(() => editor?.doc.toString() ?? '', [editor]);
  const folded = useMemo(() => foldCase(doc), [doc]);
  const best = useMemo(() => findBestMatch(doc, text, anchor, folded), [doc, text, anchor, folded]);
  const match = stepped ?? best;

  useEffect(() => {
    if (editor && match) revealDocRange(editor.view, match.from, match.to);
  }, [editor, match]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      editor?.view.focus();
    } else if (e.key === 'Enter' && match) {
      e.preventDefault();
      const next = nextMatch(doc, text, match, e.shiftKey ? -1 : 1, folded);
      if (next) setStepped(next);
    }
  }

  const line = editor && match ? editor.doc.lineAt(match.from).number : null;

  return (
    <>
      <TextInput
        ref={inputRef}
        type="text"
        value={text}
        placeholder={intl.formatMessage(messages.findPlaceholder)}
        disabled={!editor}
        onChange={(e) => {
          setText(e.target.value);
          setStepped(null);
        }}
        onKeyDown={onKeyDown}
      />
      {!editor ? (
        <Message layout="inline" tone="subtle">
          <FormattedMessage {...messages.findNoEditor} />
        </Message>
      ) : (
        <Status>
          {line !== null ? (
            <FormattedMessage {...messages.findLine} values={{ line }} />
          ) : text ? (
            <FormattedMessage {...messages.noMatches} />
          ) : (
            <FormattedMessage {...messages.findHint} />
          )}
        </Status>
      )}
    </>
  );
}

function Navigate({ onClose }: { onClose: () => void }): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const inputRef = useAutoFocus();
  const [text, setText] = useState('');
  const [highlight, setHighlight] = useState(0);
  const debouncedText = useDebouncedValue(text);

  const tree = useTree();
  const targetedFiles = useTargetedFiles();
  const targeted = useMemo(() => new Set(targetedFiles), [targetedFiles]);
  const symbols = useWorkspaceSymbols(debouncedText.trim(), SYMBOL_POOL, DEFINITION_KINDS);

  const matches = useMemo(
    () => rankNavigation(text, tree.data ?? [], symbols.data ?? [], targeted),
    [text, tree.data, symbols.data, targeted],
  );
  const active = Math.min(highlight, Math.max(matches.length - 1, 0));

  function open(match: NavigationMatch): void {
    dispatch({ type: 'file/open', path: match.path, line: match.line });
    onClose();
  }

  function move(delta: 1 | -1): void {
    if (matches.length === 0) return;
    setHighlight((active + delta + matches.length) % matches.length);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      const match = matches[active];
      if (!match) return;
      e.preventDefault();
      open(match);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <>
      <TextInput
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-autocomplete="list"
        value={text}
        placeholder={intl.formatMessage(messages.navigatePlaceholder)}
        onChange={(e) => {
          setText(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      {text.trim().length === 0 ? (
        <Status>
          <FormattedMessage {...messages.navigateHint} />
        </Status>
      ) : matches.length === 0 && !symbols.isFetching ? (
        <Status>
          <FormattedMessage {...messages.noMatches} />
        </Status>
      ) : (
        <Options role="listbox" aria-label={intl.formatMessage(messages.navigateResults)}>
          {matches.map((match, i) => {
            const kindMessage = match.kind === 'file' ? undefined : kindMessages[match.symbol.kind];
            return (
              <Option
                key={match.key}
                role="option"
                aria-selected={i === active}
                $active={i === active}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => open(match)}
              >
                {match.kind === 'file' ? (
                  <FilePath title={match.path}>
                    <HighlightedText text={match.path} ranges={match.ranges} />
                  </FilePath>
                ) : (
                  <>
                    <FilePath title={match.path}>{match.path}</FilePath>
                    <SymbolName>
                      <HighlightedText text={match.symbol.name} ranges={match.ranges} />
                    </SymbolName>
                    {kindMessage && <Caption>{intl.formatMessage(kindMessage)}</Caption>}
                  </>
                )}
              </Option>
            );
          })}
        </Options>
      )}
      {text.trim().length > 0 && symbols.isFetching && (
        <Status>
          <FormattedMessage {...messages.searchingSymbols} />
        </Status>
      )}
    </>
  );
}
