import { useMemo, useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { DefinitionSymbolKind, type WorkspaceSymbol } from '@gepard/common';
import { useUiDispatch } from '../../state/UiContext';
import { useTargetedFiles, useTree } from '../../queries/files';
import { useWorkspaceSymbols } from '../../queries/search';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { TextInput } from '../../components/TextInput';
import { HighlightedText } from '../../components/HighlightedText';
import { PathLabel } from '../../components/PathLabel';
import { Caption } from '../../components/Caption';
import { listReset } from '../../components/List';
import { rankNavigation, type NavigationMatch } from '../../helpers/navigation';
import { QuickSearchStatus } from './QuickSearchStatus';
import { useQuickSearchAutoFocus } from './useQuickSearchAutoFocus';

const messages = defineMessages({
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
    id: 'quickSearch.navigate.noMatches',
    defaultMessage: 'No matches.',
  },
  kindNamespace: { id: 'quickSearch.symbolKind.namespace', defaultMessage: 'namespace' },
  kindClass: { id: 'quickSearch.symbolKind.class', defaultMessage: 'class' },
  kindInterface: { id: 'quickSearch.symbolKind.interface', defaultMessage: 'interface' },
  kindEnum: { id: 'quickSearch.symbolKind.enum', defaultMessage: 'enum' },
  kindType: { id: 'quickSearch.symbolKind.type', defaultMessage: 'type' },
});

type SymbolKind = WorkspaceSymbol['kind'];

const SYMBOL_POOL = 40;
const DEFINITION_KINDS: SymbolKind[] = [...DefinitionSymbolKind.options];

const kindMessages: Partial<Record<SymbolKind, MessageDescriptor>> = {
  namespace: messages.kindNamespace,
  class: messages.kindClass,
  interface: messages.kindInterface,
  enum: messages.kindEnum,
  type: messages.kindType,
};

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

export function QuickSearchNavigate({ onClose }: { onClose: () => void }): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useUiDispatch();
  const inputRef = useQuickSearchAutoFocus();
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
        <QuickSearchStatus>
          <FormattedMessage {...messages.navigateHint} />
        </QuickSearchStatus>
      ) : matches.length === 0 && !symbols.isFetching ? (
        <QuickSearchStatus>
          <FormattedMessage {...messages.noMatches} />
        </QuickSearchStatus>
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
        <QuickSearchStatus>
          <FormattedMessage {...messages.searchingSymbols} />
        </QuickSearchStatus>
      )}
    </>
  );
}
