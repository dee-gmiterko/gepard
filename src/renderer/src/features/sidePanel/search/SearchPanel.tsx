import { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AtSign, Hash, Type } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { useCurrentHead } from '../../../queries/projects';
import { useTargetedFiles } from '../../../queries/files';
import { useSearchPages, type SearchParams } from '../../../queries/search';
import { IconButton } from '../../../components/IconButton';
import { Toolbar } from '../../../components/Toolbar';
import { ScopeToggle } from '../../../components/ScopeToggle';
import type { SearchScope } from '@gepard/common';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { Caption } from '../../../components/Caption';
import { Inline } from '../../../components/Layout';
import { Message } from '../../../components/Message';
import { describeError, formatErrorText } from '../../../errors/errorMessage';
import { reportQueryError } from '../../../errors/report';
import { SearchResults } from './SearchResults';
import { SearchInput } from './SearchInput';
import { countMatches } from '../../../helpers/search';
import type { WorkspaceSymbol } from '@gepard/common';

const EXPAND_ALL_UP_TO_MATCHES = 100;

const messages = defineMessages({
  regex: {
    id: 'sidePanel.search.regex',
    defaultMessage: 'Regex',
  },
  caseSensitive: {
    id: 'sidePanel.search.caseSensitive',
    defaultMessage: 'Case sensitive',
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
});

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
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

  const [query, setQuery] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [symbolFlag, setSymbolFlag] = useState(false);
  const [scope, setScope] = useState<SearchScope>('all');
  const [mode, setMode] = useState<ViewMode>('tree');
  const [selectedAt, setSelectedAt] = useState<{
    path: string;
    pos: { line: number; col: number };
  } | null>(null);

  const handleQueryChange = useCallback(
    (next: string): void => {
      setQuery(next);
      if (next !== query) setSelectedAt(null);
    },
    [query],
  );

  function pickSymbol(symbol: WorkspaceSymbol): void {
    setQuery(symbol.name);
    if (symbolFlag) setSelectedAt({ path: symbol.location.path, pos: symbol.location.range.start });
  }

  const params = useMemo<SearchParams | null>(() => {
    if (!query) return null;
    const paths = scope === 'targeted' ? targetedPaths : [];
    if (symbolFlag && selectedAt) {
      return {
        kind: 'references',
        scope,
        targetedPaths: paths,
        text: query,
        at: selectedAt,
      };
    }
    const base = { scope, targetedPaths: paths, text: query, caseSensitive };
    return regex ? { kind: 'regex', ...base } : { kind: 'pattern', ...base };
  }, [symbolFlag, selectedAt, regex, caseSensitive, scope, targetedPaths, query]);

  const searchIdentity = useMemo(
    () =>
      params
        ? JSON.stringify([
            params.kind,
            params.text,
            params.scope,
            'at' in params && params.at,
            'caseSensitive' in params && params.caseSensitive,
          ])
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
    if (search.hasNextPage && !search.isFetchingNextPage) {
      search.fetchNextPage().catch((error: unknown) => reportQueryError('search.loadMore', error));
    }
  }

  return (
    <Container>
      <SearchInput onQueryChange={handleQueryChange} onPick={pickSymbol} />

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
            icon={Type}
            label={intl.formatMessage(messages.caseSensitive)}
            size={14}
            active={caseSensitive && !symbolFlag}
            disabled={symbolFlag}
            onClick={() => setCaseSensitive((c) => !c)}
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
          <Message>{formatErrorText(intl, describeError(search.error).message)}</Message>
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
