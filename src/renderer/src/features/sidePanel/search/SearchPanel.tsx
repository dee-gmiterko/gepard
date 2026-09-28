import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { AtSign, Hash } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { useCurrentHead } from '../../../queries/projects';
import { useTargetedFiles } from '../../../queries/files';
import { useSearchPages, useWorkspaceSymbols, type SearchParams } from '../../../queries/search';
import { IconButton } from '../../../components/IconButton';
import { Combobox, fuzzyRanges } from '../../../components/Combobox';
import { HighlightedText } from '../../../components/HighlightedText';
import { Toolbar } from '../../../components/Toolbar';
import { ScopeToggle, type SearchScope } from '../../../components/ScopeToggle';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { Caption } from '../../../components/Caption';
import { Inline } from '../../../components/Layout';
import { Message } from '../../../components/Message';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { localizedErrorMessage } from '../../../errors/errorMessage';
import { SearchResults } from './SearchResults';
import { countMatches } from './searchRows';
import type { WorkspaceSymbol } from '@gepard/common/ipc/schemas/search';

type SymbolKind = WorkspaceSymbol['kind'];

const EXPAND_ALL_UP_TO_MATCHES = 100;

const messages = defineMessages({
  placeholder: {
    id: 'sidePanel.search.placeholder',
    defaultMessage: 'Search…',
  },
  regex: {
    id: 'sidePanel.search.regex',
    defaultMessage: 'Regex',
  },
  symbol: {
    id: 'sidePanel.search.symbol',
    defaultMessage: 'Symbol',
  },
  typeToSearch: {
    id: 'sidePanel.search.typeToSearch',
    defaultMessage: 'Type to search.',
  },
  searching: {
    id: 'sidePanel.search.searching',
    defaultMessage: 'Searching…',
  },
  noMatches: {
    id: 'sidePanel.search.noMatches',
    defaultMessage: 'No matches.',
  },
  matchCount: {
    id: 'sidePanel.search.matchCount',
    defaultMessage: '{count, plural, one {# match} other {# matches}}',
  },
  fileCount: {
    id: 'sidePanel.search.fileCount',
    defaultMessage: '{count, plural, one {# file} other {# files}}',
  },
  summary: {
    id: 'sidePanel.search.summary',
    defaultMessage: '{matches} in {files}',
  },
  summaryPartial: {
    id: 'sidePanel.search.summaryPartial',
    defaultMessage: '{matches} in {files} so far, scroll for more',
  },
  symbolKindNamespace: { id: 'sidePanel.search.symbolKind.namespace', defaultMessage: 'namespace' },
  symbolKindClass: { id: 'sidePanel.search.symbolKind.class', defaultMessage: 'class' },
  symbolKindInterface: { id: 'sidePanel.search.symbolKind.interface', defaultMessage: 'interface' },
  symbolKindEnum: { id: 'sidePanel.search.symbolKind.enum', defaultMessage: 'enum' },
  symbolKindEnumMember: {
    id: 'sidePanel.search.symbolKind.enumMember',
    defaultMessage: 'enum member',
  },
  symbolKindType: { id: 'sidePanel.search.symbolKind.type', defaultMessage: 'type' },
  symbolKindTypeParameter: {
    id: 'sidePanel.search.symbolKind.typeParameter',
    defaultMessage: 'type parameter',
  },
  symbolKindFunction: { id: 'sidePanel.search.symbolKind.function', defaultMessage: 'function' },
  symbolKindMethod: { id: 'sidePanel.search.symbolKind.method', defaultMessage: 'method' },
  symbolKindProperty: { id: 'sidePanel.search.symbolKind.property', defaultMessage: 'property' },
  symbolKindVariable: { id: 'sidePanel.search.symbolKind.variable', defaultMessage: 'variable' },
  symbolKindParameter: { id: 'sidePanel.search.symbolKind.parameter', defaultMessage: 'parameter' },
  symbolKindConstant: { id: 'sidePanel.search.symbolKind.constant', defaultMessage: 'constant' },
  symbolKindUnknown: { id: 'sidePanel.search.symbolKind.unknown', defaultMessage: 'unknown' },
});

const symbolKindMessages: Record<SymbolKind, MessageDescriptor> = {
  namespace: messages.symbolKindNamespace,
  class: messages.symbolKindClass,
  interface: messages.symbolKindInterface,
  enum: messages.symbolKindEnum,
  enumMember: messages.symbolKindEnumMember,
  type: messages.symbolKindType,
  typeParameter: messages.symbolKindTypeParameter,
  function: messages.symbolKindFunction,
  method: messages.symbolKindMethod,
  property: messages.symbolKindProperty,
  variable: messages.symbolKindVariable,
  parameter: messages.symbolKindParameter,
  constant: messages.symbolKindConstant,
  unknown: messages.symbolKindUnknown,
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const InputArea = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Results = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Summary = styled.div`
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
`;

export function SearchPanel(): React.JSX.Element {
  const intl = useIntl();
  const sha = useCurrentHead() ?? '';
  const targetedPaths = useTargetedFiles();

  const [text, setText] = useState('');
  const [regex, setRegex] = useState(false);
  const [symbolFlag, setSymbolFlag] = useState(false);
  const [scope, setScope] = useState<SearchScope>('all');
  const [mode, setMode] = useState<ViewMode>('tree');
  const [selectedAt, setSelectedAt] = useState<{
    path: string;
    pos: { line: number; col: number };
  } | null>(null);

  const debouncedText = useDebouncedValue(text);
  const suggestions = useWorkspaceSymbols(debouncedText, 8);
  const suggestionList = text.length > 0 ? (suggestions.data ?? []) : [];

  function pickSymbol(symbol: WorkspaceSymbol): void {
    setText(symbol.name);
    if (symbolFlag) setSelectedAt({ path: symbol.location.path, pos: symbol.location.range.start });
  }

  const params = useMemo<SearchParams | null>(() => {
    if (!debouncedText) return null;
    const paths = scope === 'targeted' ? targetedPaths : [];
    if (symbolFlag && selectedAt) {
      return {
        kind: 'references',
        scope,
        targetedPaths: paths,
        text: debouncedText,
        at: selectedAt,
      };
    }
    if (regex) return { kind: 'regex', scope, targetedPaths: paths, text: debouncedText };
    return { kind: 'pattern', scope, targetedPaths: paths, text: debouncedText };
  }, [symbolFlag, selectedAt, regex, scope, targetedPaths, debouncedText]);

  const searchIdentity = useMemo(
    () =>
      params
        ? JSON.stringify([params.kind, params.text, params.scope, 'at' in params && params.at])
        : '',
    [params],
  );

  const search = useSearchPages(sha, params);
  const active = Boolean(params) && Boolean(sha);
  const pages = search.data?.pages;
  const files = useMemo(() => pages?.flatMap((p) => p.files) ?? [], [pages]);
  const matches = useMemo(() => countMatches(files), [files]);
  const hasMore = pages?.[pages.length - 1]?.hasMore ?? false;

  function loadMore(): void {
    if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
  }

  return (
    <Container>
      <InputArea>
        <Combobox<WorkspaceSymbol>
          items={suggestionList}
          value={null}
          freeText={{
            text,
            onTextChange: (next) => {
              setText(next);
              setSelectedAt(null);
            },
            searchText: debouncedText,
          }}
          onSelect={(symbol) => symbol && pickSymbol(symbol)}
          getKey={(symbol) =>
            `${symbol.location.path}:${symbol.location.range.start.line}:${symbol.location.range.start.col}`
          }
          getLabel={(symbol) => symbol.name}
          placeholder={intl.formatMessage(messages.placeholder)}
          loading={suggestions.isFetching}
          renderOption={(symbol, { searchText }) => (
            <Inline $gap={1}>
              <span>
                <HighlightedText text={symbol.name} ranges={fuzzyRanges(searchText, symbol.name)} />
              </span>
              <Caption>{intl.formatMessage(symbolKindMessages[symbol.kind])}</Caption>
            </Inline>
          )}
        />
      </InputArea>

      <Toolbar>
        <Inline $gap={1}>
          <IconButton
            icon={Hash}
            label={intl.formatMessage(messages.regex)}
            size={14}
            active={regex && !symbolFlag}
            disabled={symbolFlag}
            onClick={() => setRegex((r) => !r)}
          />
          <IconButton
            icon={AtSign}
            label={intl.formatMessage(messages.symbol)}
            size={14}
            active={symbolFlag}
            onClick={() => {
              if (symbolFlag) {
                setSelectedAt(null);
              } else {
                setRegex(false);
              }
              setSymbolFlag(!symbolFlag);
            }}
          />
          <ScopeToggle value={scope} onChange={setScope} />
        </Inline>
        <ViewModeToggle value={mode} onChange={setMode} />
      </Toolbar>

      {!active && (
        <Results>
          <Message>
            <FormattedMessage {...messages.typeToSearch} />
          </Message>
        </Results>
      )}
      {active && search.isError && (
        <Results>
          <Message>{localizedErrorMessage(search.error).message}</Message>
        </Results>
      )}
      {active && !search.isError && !search.isSuccess && (
        <Results>
          <Message>
            <FormattedMessage {...messages.searching} />
          </Message>
        </Results>
      )}
      {active && search.isSuccess && files.length === 0 && (
        <Results>
          <Message>
            <FormattedMessage {...messages.noMatches} />
          </Message>
        </Results>
      )}
      {active && search.isSuccess && files.length > 0 && (
        <>
          <Summary>
            <Caption>
              {intl.formatMessage(hasMore ? messages.summaryPartial : messages.summary, {
                matches: intl.formatMessage(messages.matchCount, { count: matches }),
                files: intl.formatMessage(messages.fileCount, { count: files.length }),
              })}
            </Caption>
          </Summary>
          <SearchResults
            key={searchIdentity}
            files={files}
            mode={mode}
            initiallyExpanded={countMatches(pages?.[0]?.files ?? []) <= EXPAND_ALL_UP_TO_MATCHES}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </>
      )}
    </Container>
  );
}
