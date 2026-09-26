// PR targeting combobox (spec: header "series of fuzzy search select boxes").
// Typing narrows server-side through `pr.list`'s `search` and the result is
// fuzzy-filtered locally (report 01 §1.2).
import { useMemo, useState } from 'react'
import { GitPullRequest } from 'react-feather'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { usePrList } from '../../queries/prs'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { PrListItem } from '@shared/ipc/schemas/pr'

function prLabel(pr: PrListItem): string {
  return `#${pr.number} ${pr.title}`
}

/** Report 01 §1.2's fuzzy corpus: number, title, author, head branch, labels. */
function prFilterText(pr: PrListItem): string {
  return [
    `#${pr.number}`,
    pr.title,
    pr.author.login,
    pr.headRefName,
    ...pr.labels.map((l) => l.name)
  ].join(' ')
}

export function PrTarget(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''

  const [rawQuery, setRawQuery] = useState('')
  const search = useDebouncedValue(rawQuery)
  const { data: prs, isFetching } = usePrList(projectId, search || undefined)

  // Keeps the selected PR's label visible even once a later search narrows
  // it out of `prs`.
  const [selected, setSelected] = useState<PrListItem | null>(null)

  const value = useMemo(() => {
    if (state.targeting.pr === null) return null
    if (selected?.number === state.targeting.pr) return selected
    return prs?.find((pr) => pr.number === state.targeting.pr) ?? selected
  }, [state.targeting.pr, selected, prs])

  return (
    <IconField icon={GitPullRequest} width={280}>
      <Combobox<PrListItem>
        items={prs ?? []}
        value={value}
        getKey={(pr) => String(pr.number)}
        getLabel={prLabel}
        getFilterText={prFilterText}
        loading={isFetching}
        placeholder="PR…"
        onQueryChange={setRawQuery}
        onSelect={(pr) => {
          setSelected(pr)
          dispatch({ type: 'target/pr', pr: pr?.number ?? null })
        }}
      />
    </IconField>
  )
}
