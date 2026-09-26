// Reference quick-selects (coordinator spec, corrected): "checkbox + title,
// marked ones show preview of what it includes opening accordion, then shows
// button to either include all files or only targeted ones." So for "Also
// in" (search.run kind exactLine) and "Same pattern in" (search.run kind
// pattern, word match on a chosen symbol) the top checkbox *includes* every
// match currently shown (report 03 §7's grouped-result shape) as a
// reference; the accordion body is a read-only preview of exactly that set,
// and the all-files/targeted-only toggle changes which matches are included
// live. Only "Symbol definition" is a per-symbol picker (spec: "each symbol
// used on the line - can be checked to add reference by file:line") — it
// lives in its own file.
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { Accordion } from '../../components/Accordion'
import { Checkbox } from '../../components/Checkbox'
import { Stack } from '../../components/Layout'
import { PathLabel } from '../../components/PathLabel'
import { MatchLine } from '../../components/MatchLine'
import { Message } from '../../components/Message'
import { ScopeToggle, type SearchScope } from '../../components/ScopeToggle'
import { SymbolDefinitionSection } from './SymbolDefinitionSection'
import { useLineSymbols } from '../../queries/search'
import { useFileContent } from '../../queries/files'
import { clearKindIn, toggleRefIn } from './refs'
import type { CommentReference } from '@shared/ipc/schemas/comment'
import type { SearchQuery } from '@shared/ipc/schemas/search'
import { useSearch } from '../../queries/search'
import type { RefAnchor } from './anchorLine'

const Select = styled.select`
  align-self: flex-start;
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.fg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 2px ${({ theme }) => theme.space[1]};
`

interface SearchRefsSectionProps {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  disabledHint?: string
  refKind: 'exact' | 'pattern'
  /** Replaces this section's whole contribution with the given refs — called
   * whenever what's included changes (opened, closed, scope toggled, query
   * results changed). */
  onRefsChange: (refs: CommentReference[]) => void
  buildQuery: (scope: SearchScope) => SearchQuery | null
  extra?: React.ReactNode
}

function SearchRefsSection({
  title,
  open,
  onOpenChange,
  disabled,
  disabledHint,
  refKind,
  onRefsChange,
  buildQuery,
  extra
}: SearchRefsSectionProps): React.JSX.Element {
  const [scope, setScope] = useState<SearchScope>('all')
  const query = open && !disabled ? buildQuery(scope) : null
  const { data, isFetching } = useSearch(query)

  // The top checkbox includes every currently-previewed match; closing it
  // (or losing its query) clears the section's contribution.
  useEffect(() => {
    if (!open) {
      onRefsChange([])
      return
    }
    const refs: CommentReference[] = data
      ? data.files.flatMap((f) =>
          f.matches.map((m) => ({ path: f.path, line: m.line, kind: refKind }))
        )
      : []
    onRefsChange(refs)
  }, [open, data, refKind, onRefsChange])

  return (
    <Accordion
      open={open}
      disabled={disabled}
      onToggle={() => onOpenChange(!open)}
      leading={<Checkbox checked={open} disabled={disabled} onChange={() => onOpenChange(!open)} />}
      title={title}
    >
      {disabled && disabledHint ? (
        <Message layout="inline">{disabledHint}</Message>
      ) : (
        <Stack>
          <ScopeToggle value={scope} onChange={setScope} />
          {extra}
          {isFetching && <Message layout="inline">Searching…</Message>}
          {data && data.files.length === 0 && (
            <Message layout="inline">No matches — nothing will be included.</Message>
          )}
          {data?.files.map((f) => (
            <div key={f.path}>
              <PathLabel $small>{f.path}</PathLabel>
              {f.matches.map((m) => (
                <MatchLine key={m.line} line={m.line} preview={m.preview} spans={m.spans} />
              ))}
            </div>
          ))}
        </Stack>
      )}
    </Accordion>
  )
}

export interface ReferencesPanelProps {
  projectId: string
  refAnchor: RefAnchor | null
  targetedPaths: string[]
  references: CommentReference[]
  onChange: React.Dispatch<React.SetStateAction<CommentReference[]>>
}

export function ReferencesPanel({
  projectId,
  refAnchor,
  targetedPaths,
  references,
  onChange
}: ReferencesPanelProps): React.JSX.Element {
  const [symbolOpen, setSymbolOpen] = useState(false)
  const [alsoInOpen, setAlsoInOpen] = useState(false)
  const [patternOpen, setPatternOpen] = useState(false)
  const [patternSymbol, setPatternSymbol] = useState<string>('')

  const lineSymbols = useLineSymbols(
    projectId,
    refAnchor?.symbols ? refAnchor.sha : '',
    refAnchor?.path ?? '',
    refAnchor?.line ?? 1
  )
  const fileContent = useFileContent(projectId, refAnchor?.sha ?? '', refAnchor?.path ?? '')
  const symbols = useMemo(() => lineSymbols.data?.symbols ?? [], [lineSymbols.data])

  // Defaults to the line's first symbol until the user picks another.
  const effectivePatternSymbol = patternSymbol || symbols[0]?.name || ''

  const lineText = useMemo(() => {
    if (!refAnchor) return null
    const c = fileContent.data
    if (!c || c.kind !== 'text') return null
    return c.text.split('\n')[refAnchor.line - 1] ?? null
  }, [fileContent.data, refAnchor])

  // Symbol definition: granular per-row toggle.
  function toggleRef(ref: CommentReference): void {
    onChange((prev) => toggleRefIn(prev, ref))
  }
  function closeAndClearKind(kind: CommentReference['kind'], setOpen: (v: boolean) => void) {
    return (open: boolean): void => {
      setOpen(open)
      if (!open) onChange((prev) => clearKindIn(prev, kind))
    }
  }

  // Also in / Same pattern in: whole-section replace, stable across renders
  // so the section's effect only re-runs when what it should include changes.
  const setExactRefs = useCallback(
    (refs: CommentReference[]) =>
      onChange((prev) => [...prev.filter((r) => r.kind !== 'exact'), ...refs]),
    [onChange]
  )
  const setPatternRefs = useCallback(
    (refs: CommentReference[]) =>
      onChange((prev) => [...prev.filter((r) => r.kind !== 'pattern'), ...refs]),
    [onChange]
  )

  if (!refAnchor) {
    return (
      <Message layout="inline">
        References are not available for this comment (no anchor line).
      </Message>
    )
  }

  return (
    <Stack>
      <SymbolDefinitionSection
        projectId={projectId}
        refAnchor={refAnchor}
        symbols={symbols}
        loading={lineSymbols.isLoading}
        error={lineSymbols.error}
        targetedPaths={targetedPaths}
        selected={references.filter((r) => r.kind === 'symbol')}
        onToggleRef={toggleRef}
        open={symbolOpen}
        onOpenChange={closeAndClearKind('symbol', setSymbolOpen)}
      />

      <SearchRefsSection
        title="Also in"
        open={alsoInOpen}
        onOpenChange={setAlsoInOpen}
        disabled={!lineText || !lineText.trim()}
        disabledHint="This line has no text to match elsewhere."
        refKind="exact"
        onRefsChange={setExactRefs}
        buildQuery={(scope) =>
          lineText && lineText.trim()
            ? {
                projectId,
                sha: refAnchor.sha,
                scope,
                targetedPaths,
                kind: 'exactLine',
                text: lineText.trim(),
                origin: { path: refAnchor.path, line: refAnchor.line }
              }
            : null
        }
      />

      <SearchRefsSection
        title="Same pattern in"
        open={patternOpen}
        onOpenChange={setPatternOpen}
        disabled={symbols.length === 0}
        disabledHint="No symbols on this line to match a pattern on."
        refKind="pattern"
        onRefsChange={setPatternRefs}
        extra={
          symbols.length > 1 ? (
            <Select
              value={effectivePatternSymbol}
              onChange={(e) => setPatternSymbol(e.target.value)}
            >
              {symbols.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
        buildQuery={(scope) =>
          effectivePatternSymbol
            ? {
                projectId,
                sha: refAnchor.sha,
                scope,
                targetedPaths,
                kind: 'pattern',
                text: effectivePatternSymbol,
                word: true
              }
            : null
        }
      />
    </Stack>
  )
}
