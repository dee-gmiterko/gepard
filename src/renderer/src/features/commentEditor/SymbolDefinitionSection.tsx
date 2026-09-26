// "Symbol definition" reference quick-select: each symbol on the anchor line
// (`symbols.line`), its definition (`symbols.definition`), added as a
// file:line reference (coordinator spec / report 03 §7 mapping). Each symbol
// can resolve to more than one definition target; each target is its own
// checkable row.
import styled from 'styled-components'
import { useState } from 'react'
import { Accordion } from '../../components/Accordion'
import { Checkbox } from '../../components/Checkbox'
import { Inline, Stack } from '../../components/Layout'
import { PathLabel } from '../../components/PathLabel'
import { Message } from '../../components/Message'
import { ScopeToggle, type SearchScope } from '../../components/ScopeToggle'
import { useDefinition } from '../../queries/search'
import { sameRef } from './refs'
import { isTargeted } from '@shared/model/paths'
import type { CommentReference } from '@shared/ipc/schemas/comment'
import type { LineSymbolsResult } from '@shared/ipc/schemas/index'
import type { RefAnchor } from './anchorLine'

type LineSymbol = LineSymbolsResult['symbols'][number]

const SymbolName = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.fg};
  flex-shrink: 0;
`

function DefinitionRow({
  projectId,
  refAnchor,
  symbol,
  scope,
  targetedPaths,
  selected,
  onToggleRef
}: {
  projectId: string
  refAnchor: RefAnchor
  symbol: LineSymbol
  scope: SearchScope
  targetedPaths: string[]
  selected: CommentReference[]
  onToggleRef: (ref: CommentReference) => void
}): React.JSX.Element | null {
  const pos = { line: symbol.range.start.line, col: symbol.range.start.col }
  // A failed `symbols.definition` reaches the unified toast surface via the
  // global query cache (main.tsx); with no data this row just contributes no
  // targets rather than duplicating that error inline.
  const { data, isFetching } = useDefinition(projectId, refAnchor.sha, refAnchor.path, pos)

  if (isFetching) return <Message layout="inline">{symbol.name}…</Message>

  const targets = (data?.definitions ?? []).filter(
    (d) => !d.external && (scope === 'all' || isTargeted(d.location.path, targetedPaths))
  )
  if (targets.length === 0) return null

  return (
    <>
      {targets.map((t, i) => {
        const ref: CommentReference = {
          path: t.location.path,
          line: t.location.range.start.line,
          kind: 'symbol'
        }
        const checked = selected.some((r) => sameRef(r, ref))
        return (
          <Inline key={`${symbol.name}-${i}`}>
            <Checkbox checked={checked} onChange={() => onToggleRef(ref)} />
            <SymbolName>{symbol.name}</SymbolName>
            <PathLabel>
              {t.location.path}:{t.location.range.start.line}
            </PathLabel>
          </Inline>
        )
      })}
    </>
  )
}

export function SymbolDefinitionSection({
  projectId,
  refAnchor,
  symbols,
  loading,
  error,
  targetedPaths,
  selected,
  onToggleRef,
  open,
  onOpenChange
}: {
  projectId: string
  refAnchor: RefAnchor
  symbols: LineSymbol[]
  loading: boolean
  error: Error | null
  targetedPaths: string[]
  selected: CommentReference[]
  onToggleRef: (ref: CommentReference) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [scope, setScope] = useState<SearchScope>('all')
  const disabled = !loading && !error && symbols.length === 0

  return (
    <Accordion
      open={open}
      disabled={disabled}
      onToggle={() => onOpenChange(!open)}
      leading={<Checkbox checked={open} disabled={disabled} onChange={() => onOpenChange(!open)} />}
      title="Symbol definition"
    >
      <Stack $gap={1}>
        <ScopeToggle value={scope} onChange={setScope} />
        {loading && <Message layout="inline">Loading symbols…</Message>}
        {!loading && !error && symbols.length === 0 && (
          <Message layout="inline">No symbols on this line.</Message>
        )}
        {symbols.map((symbol, i) => (
          <DefinitionRow
            key={`${symbol.name}-${symbol.range.start.line}-${symbol.range.start.col}-${i}`}
            projectId={projectId}
            refAnchor={refAnchor}
            symbol={symbol}
            scope={scope}
            targetedPaths={targetedPaths}
            selected={selected}
            onToggleRef={onToggleRef}
          />
        ))}
      </Stack>
    </Accordion>
  )
}
