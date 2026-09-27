import { useMemo } from 'react'
import { Folder } from 'react-feather'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { useChangedFiles, useTree } from '../../queries/files'
import { useCurrentHead } from '../../queries/projects'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { activeTargetRef, folderSourcePaths, foldersOf } from '../../state/selectors'

export function PathTarget(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const head = useCurrentHead(state.projectId)
  const tree = useTree(projectId, head ?? '')
  const changed = useChangedFiles(projectId, state.checkout?.base ?? '', state.checkout?.head ?? '')
  const scoped = activeTargetRef(state.targeting) !== null

  const folders = useMemo(() => {
    const changedPaths = changed.data?.map((f) => f.path)
    const source = folderSourcePaths(state.targeting, changedPaths, tree.data ?? [])
    return foldersOf(source)
  }, [state.targeting, changed.data, tree.data])
  const isFetching = scoped ? changed.isFetching : tree.isFetching

  return (
    <IconField icon={Folder} width={220}>
      <Combobox<string>
        items={folders}
        value={state.targeting.path}
        getKey={(f) => f}
        getLabel={(f) => f}
        loading={isFetching}
        placeholder="Path…"
        onSelect={(path) => dispatch({ type: 'target/path', path })}
      />
    </IconField>
  )
}
