import { useMemo } from 'react'
import { useAppDispatch, useAppState } from '../state/AppContext'
import { useSetViewed, useViewed } from '../queries/comments'
import { getTargetedOrder } from './targetedOrder'
import { nextTargetedFile } from './navigate'

export interface Commands {
  toggleViewed: () => void
  nextFile: () => void
  prevFile: () => void
}

export function useCommands(): Commands {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr

  const { data: viewed } = useViewed(projectId, pr ?? NaN)
  const { mutate: setViewed } = useSetViewed(projectId, pr ?? NaN)
  const activePath = state.activeFile

  return useMemo<Commands>(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path))

    function move(direction: 1 | -1): void {
      const next = nextTargetedFile(getTargetedOrder(), activePath, viewedPaths, direction)
      if (next !== null) dispatch({ type: 'file/open', path: next })
    }

    return {
      toggleViewed: () => {
        if (pr === null || activePath === null) return
        setViewed({ paths: [activePath], viewed: !viewedPaths.has(activePath) })
      },
      nextFile: () => move(1),
      prevFile: () => move(-1)
    }
  }, [activePath, pr, viewed, setViewed, dispatch])
}
