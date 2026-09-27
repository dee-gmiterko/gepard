import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { AtSign, Hash } from 'react-feather'
import { useAppState, useAppDispatch } from '../../../state/AppContext'
import { useCurrentHead } from '../../../queries/projects'
import { useTargetedPaths } from '../../../queries/files'
import { useSearch, useWorkspaceSymbols } from '../../../queries/search'
import { IconButton } from '../../../components/IconButton'
import { Tree, buildTree, buildFlatList, type TreeNode } from '../../../components/Tree'
import { fuzzyRanges } from '../../../components/Combobox'
import { HighlightedText } from '../../../components/HighlightedText'
import { Menu, MenuItem } from '../../../components/Menu'
import { TextInput } from '../../../components/TextInput'
import { Toolbar } from '../../../components/Toolbar'
import { ScopeToggle, type SearchScope } from '../../../components/ScopeToggle'
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle'
import { MatchLine } from '../../../components/MatchLine'
import { Caption } from '../../../components/Caption'
import { Inline } from '../../../components/Layout'
import { Message } from '../../../components/Message'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { FileRowMarks } from '../fileRows/FileRowMarks'
import { useRowData } from '../fileRows/rowData'
import type { GroupedResult, SearchQuery, WorkspaceSymbol } from '@shared/ipc/schemas/search'

type FileMatches = GroupedResult['files'][number]
type MatchItem = FileMatches['matches'][number]

type SearchRowData =
  { kind: 'file'; file: FileMatches } | { kind: 'match'; match: MatchItem; filePath: string }

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

const InputAnchor = styled.div`
  position: relative;
`

const SymbolKind = styled.span`
  color: ${({ theme }) => theme.colors.fgMuted};
  margin-left: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
`

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

  const debouncedText = useDebouncedValue(text)
  const suggestions = useWorkspaceSymbols(projectId, sha, debouncedText, 8)
  const suggestRef = useRef<HTMLDivElement>(null)
  const { pr, rowFor } = useRowData()

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node))
        setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pickSymbol(symbol: WorkspaceSymbol): void {
    setText(symbol.name)
    if (symbolFlag) setSelectedAt({ path: symbol.location.path, pos: symbol.location.range.start })
    setSuggestOpen(false)
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
            placeholder="Search…"
            onChange={(e) => {
              setText(e.target.value)
              setSelectedAt(null)
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
          />
          {suggestOpen && text.length > 0 && (suggestions.data?.length ?? 0) > 0 && (
            <Menu>
              {(suggestions.data ?? []).map((symbol, i) => (
                <MenuItem
                  key={`${symbol.location.path}:${symbol.location.range.start.line}:${i}`}
                  onClick={() => pickSymbol(symbol)}
                >
                  <HighlightedText text={symbol.name} ranges={fuzzyRanges(text, symbol.name)} />
                  <SymbolKind>{symbol.kind}</SymbolKind>
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
            label="Regex"
            size={14}
            active={regex}
            disabled={symbolFlag}
            onClick={() => setRegex((r) => !r)}
          />
          <IconButton
            icon={AtSign}
            label="Symbol"
            size={14}
            active={symbolFlag}
            onClick={() => {
              if (symbolFlag) setSelectedAt(null)
              setSymbolFlag(!symbolFlag)
            }}
          />
          <ScopeToggle value={scope} onChange={setScope} />
        </Inline>
        <ViewModeToggle value={mode} onChange={setMode} />
      </Toolbar>

      <Results>
        {!query && <Message>Type to search.</Message>}
        {query && isFetching && <Message>Searching…</Message>}
        {query && !isFetching && (result?.totalMatches ?? 0) === 0 && (
          <Message>No matches.</Message>
        )}
        {query && !isFetching && (result?.totalMatches ?? 0) > 0 && (
          <Tree<SearchRowData>
            nodes={nodes}
            selectedPath={state.activeFile}
            onSelectFile={(node) => {
              if (node.data?.kind === 'match')
                dispatch({ type: 'file/open', path: node.data.filePath })
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
