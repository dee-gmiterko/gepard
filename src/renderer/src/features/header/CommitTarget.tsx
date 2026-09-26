// Commit targeting combobox (spec: header "series of fuzzy search select
// boxes"). With a PR targeted, commits are limited to that PR's
// (`pr.commits`; spec: "setting a PR limits commits to ones from it");
// without one, commits come from `commits.list`, narrowed server-side by the
// typed text and by the targeted folder. Either way the list is
// fuzzy-filtered locally.
import { useMemo, useState } from 'react'
import { GitCommit } from 'react-feather'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { usePrCommits, useCommits } from '../../queries/prs'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { Commit } from '@shared/ipc/schemas/pr'

function commitLabel(commit: Commit): string {
  return `${commit.oid.slice(0, 7)} ${commit.messageHeadline}`
}

export function CommitTarget(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const folder = state.targeting.folder ?? undefined
  const usingPr = pr !== null

  const [rawQuery, setRawQuery] = useState('')
  const search = useDebouncedValue(rawQuery)
  const [selected, setSelected] = useState<Commit | null>(null)

  const prCommits = usePrCommits(projectId, pr ?? NaN)
  const repoCommits = useCommits(projectId, { search: search || undefined, path: folder }, !usingPr)

  const items = useMemo(
    () => (usingPr ? (prCommits.data ?? []) : (repoCommits.data ?? [])),
    [usingPr, prCommits.data, repoCommits.data]
  )
  const isFetching = usingPr ? prCommits.isFetching : repoCommits.isFetching

  const value = useMemo(() => {
    if (state.targeting.commit === null) return null
    if (selected?.oid === state.targeting.commit) return selected
    return items.find((c) => c.oid === state.targeting.commit) ?? selected
  }, [state.targeting.commit, selected, items])

  return (
    <IconField icon={GitCommit} width={240}>
      <Combobox<Commit>
        items={items}
        value={value}
        getKey={(c) => c.oid}
        getLabel={commitLabel}
        loading={isFetching}
        placeholder="Commit…"
        onQueryChange={setRawQuery}
        onSelect={(commit) => {
          setSelected(commit)
          dispatch({ type: 'target/commit', sha: commit?.oid ?? null })
        }}
      />
    </IconField>
  )
}
