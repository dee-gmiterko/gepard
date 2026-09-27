import { useMemo } from 'react'
import { useAppDispatch, useAppState } from '../state/AppContext'
import { useSetViewed, useViewed } from '../queries/comments'
import { useChangedFiles, useTargetedFiles } from '../queries/files'
import { nextTargetedFile } from './navigate'

export interface Commands {
  toggleViewed: (path?: string | null) => boolean
  nextFile: () => boolean
  prevFile: () => boolean
}

export function useCommands(): Commands {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const pr = state.targeting.pr

  const { data: viewed } = useViewed()
  const { mutate: setViewed } = useSetViewed()
  const { data: changedFiles } = useChangedFiles()
  const activePath = state.activeFile
  const targetedFiles = useTargetedFiles()

  return useMemo<Commands>(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path))
    // Viewed only exists for the PR's changed files.
    const changedPaths = new Set<string>()
    for (const f of changedFiles ?? []) {
      changedPaths.add(f.path)
      if (f.previousPath) changedPaths.add(f.previousPath)
    }

    function move(direction: 1 | -1): boolean {
      const next = nextTargetedFile(targetedFiles, activePath, viewedPaths, direction)
      if (next === null) return false
      dispatch({ type: 'file/open', path: next })
      return true
    }

    return {
      toggleViewed: (path = activePath) => {
        if (pr === null || path === null || !changedPaths.has(path)) return false
        setViewed({ paths: [path], viewed: !viewedPaths.has(path) })
        return true
      },
      nextFile: () => move(1),
      prevFile: () => move(-1)
    }
  }, [activePath, pr, viewed, changedFiles, setViewed, dispatch, targetedFiles])
}
