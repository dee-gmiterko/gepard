import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styled from 'styled-components'
import { AtSign, Hash } from 'react-feather'
import { FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
import { useAppState, useAppDispatch } from '../../../state/AppContext'
import { useCurrentHead } from '../../../queries/projects'
import { useTargetedPaths } from '../../../queries/files'
import { useSearch, useWorkspaceSymbols } from '../../../queries/search'
import { IconButton } from '../../../components/IconButton'
import { Tree, buildTree, buildFlatList, type TreeNode } from '../../../components/Tree'
import { fuzzyRanges, NO_HIGHLIGHT } from '../../../components/Combobox'
import { HighlightedText } from '../../../components/HighlightedText'
import { Menu, MenuAnchor, MenuItem } from '../../../components/Menu'
import { TextInput } from '../../../components/TextInput'
import { Toolbar } from '../../../components/Toolbar'
import { ScopeToggle, type SearchScope } from '../../../components/ScopeToggle'
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle'
import { MatchLine } from '../../../components/MatchLine'
import { Caption } from '../../../components/Caption'
import { Inline } from '../../../components/Layout'
import { Message } from '../../../components/Message'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useOutsideClick } from '../../../hooks/useOutsideClick'
import { FileRowMarks } from '../fileRows/FileRowMarks'
import { useRowData } from '../fileRows/rowData'
import type { GroupedResult, SearchQuery, WorkspaceSymbol } from '@shared/ipc/schemas/search'

type FileMatches = GroupedResult['files'][number]
type MatchItem = FileMatches['matches'][number]
type SymbolKind = WorkspaceSymbol['kind']

type SearchRowData =
  { kind: 'file'; file: FileMatches } | { kind: 'match'; match: MatchItem; filePath: string }

const messages = defineMessages({
  placeholder: {
    id: 'sidePanel.search.placeholder',
    defaultMessage: 'Search…'
  },
  regex: {
    id: 'sidePanel.search.regex',
    defaultMessage: 'Regex'
  },
  symbol: {
    id: 'sidePanel.search.symbol',
    defaultMessage: 'Symbol'
  },
  typeToSearch: {
    id: 'sidePanel.search.typeToSearch',
    defaultMessage: 'Type to search.'
  },
  searching: {
    id: 'sidePanel.search.searching',
    defaultMessage: 'Searching…'
  },
  noMatches: {
    id: 'sidePanel.search.noMatches',
    defaultMessage: 'No matches.'
  },
  symbolKindNamespace: { id: 'sidePanel.search.symbolKind.namespace', defaultMessage: 'namespace' },
  symbolKindClass: { id: 'sidePanel.search.symbolKind.class', defaultMessage: 'class' },
  symbolKindInterface: { id: 'sidePanel.search.symbolKind.interface', defaultMessage: 'interface' },
  symbolKindEnum: { id: 'sidePanel.search.symbolKind.enum', defaultMessage: 'enum' },
  symbolKindEnumMember: {
    id: 'sidePanel.search.symbolKind.enumMember',
    defaultMessage: 'enum member'
  },
  symbolKindType: { id: 'sidePanel.search.symbolKind.type', defaultMessage: 'type' },
  symbolKindTypeParameter: {
    id: 'sidePanel.search.symbolKind.typeParameter',
    defaultMessage: 'type parameter'
  },
  symbolKindFunction: { id: 'sidePanel.search.symbolKind.function', defaultMessage: 'function' },
  symbolKindMethod: { id: 'sidePanel.search.symbolKind.method', defaultMessage: 'method' },
  symbolKindProperty: { id: 'sidePanel.search.symbolKind.property', defaultMessage: 'property' },
  symbolKindVariable: { id: 'sidePanel.search.symbolKind.variable', defaultMessage: 'variable' },
  symbolKindParameter: { id: 'sidePanel.search.symbolKind.parameter', defaultMessage: 'parameter' },
  symbolKindConstant: { id: 'sidePanel.search.symbolKind.constant', defaultMessage: 'constant' },
  symbolKindUnknown: { id: 'sidePanel.search.symbolKind.unknown', defaultMessage: 'unknown' }
})

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
  unknown: messages.symbolKindUnknown
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`

const InputArea = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const InputAnchor = MenuAnchor

const Results = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`

function toSearchTree(nodes: TreeNode<FileMatches>[]): TreeNode<SearchRowData>[] {
  return nodes.map((n) => {
    if (n.isFolder) {
      return { path: n.path, name: n.name, isFolder: true, children: toSearchTree(n.children) }
    }
    const file = n.data as FileMatches
    return {
      path: n.path,
      name: n.name,
      isFolder: true,
      data: { kind: 'file', file },
      children: file.matches.map((match, i) => ({
        path: `${n.path}#${i}`,
        name: String(match.line),
        isFolder: false,
        children: [],
        data: { kind: 'match', match, filePath: n.path } as SearchRowData
      }))
    }
  })
}

export function SearchPanel(): React.JSX.Element {
  const intl = useIntl()
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const sha = useCurrentHead(state.projectId) ?? ''
  const targetedPaths = useTargetedPaths()

  const [text, setText] = useState('')
  const [regex, setRegex] = useState(false)
  const [symbolFlag, setSymbolFlag] = useState(false)
  const [scope, setScope] = useState<SearchScope>('all')
  const [mode, setMode] = useState<ViewMode>('tree')
  const [selectedAt, setSelectedAt] = useState<{
    path: string
    pos: { line: number; col: number }
  } | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestHighlight, setSuggestHighlight] = useState(NO_HIGHLIGHT)

  const debouncedText = useDebouncedValue(text)
  const suggestions = useWorkspaceSymbols(projectId, sha, debouncedText, 8)
  const suggestionList = suggestions.data ?? []
  const suggestActive = Math.min(suggestHighlight, Math.max(suggestionList.length - 1, 0))
  const suggestRef = useRef<HTMLDivElement>(null)
  const { pr, rowFor } = useRowData()

  useOutsideClick(suggestRef, () => setSuggestOpen(false))

  function pickSymbol(symbol: WorkspaceSymbol): void {
    setText(symbol.name)
    if (symbolFlag) setSelectedAt({ path: symbol.location.path, pos: symbol.location.range.start })
    setSuggestOpen(false)
  }

  function handleSuggestKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!suggestOpen || suggestionList.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestHighlight(Math.max(0, Math.min(suggestActive + 1, suggestionList.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestHighlight(Math.max(suggestActive - 1, NO_HIGHLIGHT))
    } else if (e.key === 'Enter') {
      if (suggestActive === NO_HIGHLIGHT) return
      const symbol = suggestionList[suggestActive]
      if (symbol) {
        e.preventDefault()
        pickSymbol(symbol)
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  const query = useMemo<SearchQuery | null>(() => {
    if (!projectId || !sha || !debouncedText) return null
    if (symbolFlag && selectedAt) {
      return {
        kind: 'references',
        projectId,
        sha,
        scope,
        targetedPaths,
        text: debouncedText,
        at: selectedAt
      }
    }
    if (regex) return { kind: 'regex', projectId, sha, scope, targetedPaths, text: debouncedText }
    return { kind: 'pattern', projectId, sha, scope, targetedPaths, text: debouncedText }
  }, [projectId, sha, symbolFlag, selectedAt, regex, scope, targetedPaths, debouncedText])

  const { data: result, isFetching } = useSearch(query)

  const items = useMemo(
    () => (result?.files ?? []).map((f) => ({ path: f.path, data: f })),
    [result]
  )

  const nodes = useMemo(() => {
    const base = mode === 'flat' ? buildFlatList(items) : buildTree(items)
    return toSearchTree(base)
  }, [items, mode])

  return (
    <Container>
      <InputArea>
        <InputAnchor ref={suggestRef}>
          <TextInput
            value={text}
            placeholder={intl.formatMessage(messages.placeholder)}
            onChange={(e) => {
              setText(e.target.value)
              setSelectedAt(null)
              setSuggestOpen(true)
              setSuggestHighlight(NO_HIGHLIGHT)
            }}
            onFocus={() => {
              setSuggestOpen(true)
              setSuggestHighlight(NO_HIGHLIGHT)
            }}
            onKeyDown={handleSuggestKeyDown}
          />
          {suggestOpen && text.length > 0 && suggestionList.length > 0 && (
            <Menu>
              {suggestionList.map((symbol, i) => (
                <MenuItem
                  key={`${symbol.location.path}:${symbol.location.range.start.line}:${i}`}
                  $active={i === suggestActive}
                  onClick={() => pickSymbol(symbol)}
                  onMouseEnter={() => setSuggestHighlight(i)}
                >
                  <Inline $gap={1}>
                    <span>
                      <HighlightedText text={symbol.name} ranges={fuzzyRanges(text, symbol.name)} />
                    </span>
                    <Caption>{intl.formatMessage(symbolKindMessages[symbol.kind])}</Caption>
                  </Inline>
                </MenuItem>
              ))}
            </Menu>
          )}
        </InputAnchor>
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
                setSelectedAt(null)
              } else {
                setRegex(false)
              }
              setSymbolFlag(!symbolFlag)
            }}
          />
          <ScopeToggle value={scope} onChange={setScope} />
        </Inline>
        <ViewModeToggle value={mode} onChange={setMode} />
      </Toolbar>

      <Results>
        {!query && (
          <Message>
            <FormattedMessage {...messages.typeToSearch} />
          </Message>
        )}
        {query && isFetching && (
          <Message>
            <FormattedMessage {...messages.searching} />
          </Message>
        )}
        {query && !isFetching && (result?.totalMatches ?? 0) === 0 && (
          <Message>
            <FormattedMessage {...messages.noMatches} />
          </Message>
        )}
        {query && !isFetching && (result?.totalMatches ?? 0) > 0 && (
          <Tree<SearchRowData>
            nodes={nodes}
            isSelected={(node) =>
              node.data?.kind === 'match' && node.data.filePath === state.activeFile
            }
            onSelectFile={(node) => {
              if (node.data?.kind === 'match')
                dispatch({
                  type: 'file/open',
                  path: node.data.filePath,
                  line: node.data.match.line
                })
            }}
            renderFile={(node) =>
              node.data?.kind === 'match' ? (
                <MatchLine
                  line={node.data.match.line}
                  preview={node.data.match.preview}
                  spans={node.data.match.spans}
                />
              ) : null
            }
            renderFolder={(node) =>
              node.data?.kind === 'file' ? (
                <>
                  <Caption>{node.data.file.matches.length}</Caption>
                  <FileRowMarks data={rowFor(node.path)} paths={[node.path]} pr={pr} />
                </>
              ) : null
            }
          />
        )}
      </Results>
    </Container>
  )
}
