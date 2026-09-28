import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { AtSign, Hash } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { useAppState, useAppDispatch } from '../../../state/AppContext';
import { useCurrentHead } from '../../../queries/projects';
import { useTargetedFiles } from '../../../queries/files';
import { useSearch, useWorkspaceSymbols, type SearchParams } from '../../../queries/search';
import { IconButton } from '../../../components/IconButton';
import { Tree, TreeLabel, buildTree, buildFlatList, type TreeNode } from '../../../components/Tree';
import { Combobox, fuzzyRanges } from '../../../components/Combobox';
import { HighlightedText } from '../../../components/HighlightedText';
import { Toolbar } from '../../../components/Toolbar';
import { ScopeToggle, type SearchScope } from '../../../components/ScopeToggle';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { MatchLine } from '../../../components/MatchLine';
import { Caption } from '../../../components/Caption';
import { Inline } from '../../../components/Layout';
import { Message } from '../../../components/Message';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { FileRowMarks } from '../fileRows/FileRowMarks';
import { useRowData } from '../fileRows/rowData';
import type { GroupedResult, WorkspaceSymbol } from '@shared/ipc/schemas/search';

type FileMatches = GroupedResult['files'][number];
type MatchItem = FileMatches['matches'][number];
type SymbolKind = WorkspaceSymbol['kind'];

type SearchRowData =
  { kind: 'file'; file: FileMatches } | { kind: 'match'; match: MatchItem; filePath: string };

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

function toSearchTree(nodes: TreeNode<FileMatches>[]): TreeNode<SearchRowData>[] {
  return nodes.map((n) => {
    if (n.isFolder) {
      return { path: n.path, name: n.name, isFolder: true, children: toSearchTree(n.children) };
    }
    const file = n.data as FileMatches;
    return {
      path: n.path,
      name: n.name,
      isFolder: false,
      data: { kind: 'file', file },
      children: file.matches.map((match, i) => ({
        path: `${n.path}#${i}`,
        name: String(match.line),
        isFolder: false,
        children: [],
        data: { kind: 'match', match, filePath: n.path } as SearchRowData,
      })),
    };
  });
}

export function SearchPanel(): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const dispatch = useAppDispatch();
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
  const { rowFor } = useRowData();

  function pickSymbol(symbol: WorkspaceSymbol): void {
    setText(symbol.name);
    if (symbolFlag) setSelectedAt({ path: symbol.location.path, pos: symbol.location.range.start });
  }

  const params = useMemo<SearchParams | null>(() => {
    if (!debouncedText) return null;
    if (symbolFlag && selectedAt) {
      return { kind: 'references', scope, targetedPaths, text: debouncedText, at: selectedAt };
    }
    if (regex) return { kind: 'regex', scope, targetedPaths, text: debouncedText };
    return { kind: 'pattern', scope, targetedPaths, text: debouncedText };
  }, [symbolFlag, selectedAt, regex, scope, targetedPaths, debouncedText]);

  const { data: result, isFetching } = useSearch(sha, params);
  const active = Boolean(params) && Boolean(sha);

  const items = useMemo(
    () => (result?.files ?? []).map((f) => ({ path: f.path, data: f })),
    [result],
  );

  const nodes = useMemo(() => {
    const base = mode === 'flat' ? buildFlatList(items) : buildTree(items);
    return toSearchTree(base);
  }, [items, mode]);

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

      <Results>
        {!active && (
          <Message>
            <FormattedMessage {...messages.typeToSearch} />
          </Message>
        )}
        {active && isFetching && (
          <Message>
            <FormattedMessage {...messages.searching} />
          </Message>
        )}
        {active && !isFetching && (result?.totalMatches ?? 0) === 0 && (
          <Message>
            <FormattedMessage {...messages.noMatches} />
          </Message>
        )}
        {active && !isFetching && (result?.totalMatches ?? 0) > 0 && (
          <Tree<SearchRowData>
            nodes={nodes}
            selectedPath={state.activeFile}
            isSelected={(node) =>
              node.data?.kind === 'match' && node.data.filePath === state.activeFile
            }
            onSelectFile={(node) => {
              if (node.data?.kind === 'match') {
                dispatch({
                  type: 'file/open',
                  path: node.data.filePath,
                  line: node.data.match.line,
                });
              } else if (node.data?.kind === 'file') {
                dispatch({ type: 'file/open', path: node.path });
              }
            }}
            renderFile={(node) =>
              node.data?.kind === 'match' ? (
                <MatchLine
                  line={node.data.match.line}
                  preview={node.data.match.preview}
                  spans={node.data.match.spans}
                />
              ) : node.data?.kind === 'file' ? (
                <>
                  <TreeLabel title={node.path}>{node.name}</TreeLabel>
                  <Caption>{node.data.file.matches.length}</Caption>
                  <FileRowMarks data={rowFor(node.path)} paths={[node.path]} />
                </>
              ) : null
            }
          />
        )}
      </Results>
    </Container>
  );
}
