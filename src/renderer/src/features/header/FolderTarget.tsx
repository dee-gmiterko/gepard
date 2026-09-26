// Folder targeting combobox (spec: header "series of fuzzy search select
// boxes"). Folders are derived client-side from the full tree at the current
// head (contract `trees.get`: "folders are derived client-side"); folder
// targeting never checks out, so this box has no side effects of its own
// beyond the reducer dispatch.
import { useMemo } from 'react'
import { Folder } from 'react-feather'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { useTree } from '../../queries/files'
import { useCurrentHead } from '../../queries/projects'
import { useAppDispatch, useAppState } from '../../state/AppContext'

function foldersOf(paths: readonly string[]): string[] {
  const set = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/')
    parts.pop() // drop the file name, keep only directories
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      set.add(acc)
    }
  }
  return [...set].sort()
}

export function FolderTarget(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const head = useCurrentHead(state.projectId)
  const { data: paths, isFetching } = useTree(projectId, head ?? '')

  const folders = useMemo(() => foldersOf(paths ?? []), [paths])

  return (
    <IconField icon={Folder} width={220}>
      <Combobox<string>
        items={folders}
        value={state.targeting.folder}
        getKey={(f) => f}
        getLabel={(f) => f}
        loading={isFetching}
        placeholder="Folder…"
        onSelect={(folder) => dispatch({ type: 'target/folder', path: folder })}
      />
    </IconField>
  )
}
