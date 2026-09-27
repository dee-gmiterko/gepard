import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Accordion } from '../../components/Accordion'
import { Checkbox } from '../../components/Checkbox'
import { Stack } from '../../components/Layout'
import { PathLabel } from '../../components/PathLabel'
import { MatchLine } from '../../components/MatchLine'
import { Message } from '../../components/Message'
import { ScopeToggle, type SearchScope } from '../../components/ScopeToggle'
import { Select } from '../../components/Select'
import { SymbolDefinitionSection } from './SymbolDefinitionSection'
import { useLineSymbols } from '../../queries/search'
import { useFileContent } from '../../queries/files'
import { clearKindIn, toggleRefIn } from './refs'
import type { CommentReference } from '@shared/ipc/schemas/comment'
import type { SearchQuery } from '@shared/ipc/schemas/search'
import { useSearch } from '../../queries/search'
import type { RefAnchor } from './anchorLine'

const messages = defineMessages({
  searching: {
    id: 'commentEditor.referencesPanel.searching',
    defaultMessage: 'Searching…'
  },
  noMatches: {
    id: 'commentEditor.referencesPanel.noMatches',
    defaultMessage: 'No matches — nothing will be included.'
  },
  alsoIn: {
    id: 'commentEditor.referencesPanel.alsoIn',
    defaultMessage: 'Also in'
  },
  alsoInDisabledHint: {
    id: 'commentEditor.referencesPanel.alsoInDisabledHint',
    defaultMessage: 'This line has no text to match elsewhere.'
  },
  samePatternIn: {
    id: 'commentEditor.referencesPanel.samePatternIn',
    defaultMessage: 'Same pattern in'
  },
  samePatternDisabledHint: {
    id: 'commentEditor.referencesPanel.samePatternDisabledHint',
    defaultMessage: 'No symbols on this line to match a pattern on.'
  },
  noAnchor: {
    id: 'commentEditor.referencesPanel.noAnchor',
    defaultMessage: 'References are not available for this comment (no anchor line).'
  }
})

interface SearchRefsSectionProps {
  title: MessageDescriptor
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  disabledHint?: MessageDescriptor
  refKind: 'exact' | 'pattern'
  onRefsChange: (refs: CommentReference[]) => void
  buildQuery: (scope: SearchScope) => SearchQuery | null
  extra?: ReactNode
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
  const intl = useIntl()
  const [scope, setScope] = useState<SearchScope>('all')
  const query = open && !disabled ? buildQuery(scope) : null
  const { data, isFetching } = useSearch(query)

  useEffect(() => {
    if (!open) return
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
      leading={
        <Checkbox
          checked={open}
          disabled={disabled}
          ariaLabel={intl.formatMessage(title)}
          onChange={() => onOpenChange(!open)}
        />
      }
      title={<FormattedMessage {...title} />}
      trailing={
        disabled && disabledHint ? (
          <Message layout="inline">
            <FormattedMessage {...disabledHint} />
          </Message>
        ) : undefined
      }
    >
      <Stack>
        <ScopeToggle value={scope} onChange={setScope} />
        {extra}
        {isFetching && (
          <Message layout="inline">
            <FormattedMessage {...messages.searching} />
          </Message>
        )}
        {data && data.files.length === 0 && (
          <Message layout="inline">
            <FormattedMessage {...messages.noMatches} />
          </Message>
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
  const [symbolOpen, setSymbolOpen] = useState(() => references.some((r) => r.kind === 'symbol'))
  const [alsoInOpen, setAlsoInOpen] = useState(() => references.some((r) => r.kind === 'exact'))
  const [patternOpen, setPatternOpen] = useState(() => references.some((r) => r.kind === 'pattern'))
  const [patternSymbol, setPatternSymbol] = useState<string>('')

  const lineSymbols = useLineSymbols(
    projectId,
    refAnchor?.symbolsResolvable ? refAnchor.sha : '',
    refAnchor?.path ?? '',
    refAnchor?.line ?? 1
  )
  const fileContent = useFileContent(projectId, refAnchor?.sha ?? '', refAnchor?.path ?? '')
  const symbols = useMemo(() => lineSymbols.data?.symbols ?? [], [lineSymbols.data])

  const effectivePatternSymbol = patternSymbol || symbols[0]?.name || ''

  const lineText = useMemo(() => {
    if (!refAnchor) return null
    const c = fileContent.data
    if (!c || c.kind !== 'text') return null
    return c.text.split('\n')[refAnchor.line - 1] ?? null
  }, [fileContent.data, refAnchor])

  function toggleRef(ref: CommentReference): void {
    onChange((prev) => toggleRefIn(prev, ref))
  }
  function closeAndClearKind(kind: CommentReference['kind'], setOpen: (v: boolean) => void) {
    return (open: boolean): void => {
      setOpen(open)
      if (!open) onChange((prev) => clearKindIn(prev, kind))
    }
  }

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
        <FormattedMessage {...messages.noAnchor} />
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
        title={messages.alsoIn}
        open={alsoInOpen}
        onOpenChange={closeAndClearKind('exact', setAlsoInOpen)}
        disabled={!lineText || !lineText.trim()}
        disabledHint={messages.alsoInDisabledHint}
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
        title={messages.samePatternIn}
        open={patternOpen}
        onOpenChange={closeAndClearKind('pattern', setPatternOpen)}
        disabled={symbols.length === 0}
        disabledHint={messages.samePatternDisabledHint}
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
