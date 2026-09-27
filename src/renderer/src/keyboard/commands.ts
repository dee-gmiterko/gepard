import { useMemo } from 'react'
import { useAppDispatch, useAppState } from '../state/AppContext'
import { useSetViewed, useViewed } from '../queries/comments'
import { useTargetedOrderRef } from '../state/targetedOrderStore'
import { nextTargetedFile } from './navigate'

export interface Commands {
  toggleViewed: () => boolean
  nextFile: () => boolean
  prevFile: () => boolean
}

export function useCommands(): Commands {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr

  const { data: viewed } = useViewed(projectId, pr ?? NaN)
  const { mutate: setViewed } = useSetViewed(projectId, pr ?? NaN)
  const activePath = state.activeFile
  const targetedOrderRef = useTargetedOrderRef()

  return useMemo<Commands>(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path))

    function move(direction: 1 | -1): boolean {
      const next = nextTargetedFile(targetedOrderRef.current, activePath, viewedPaths, direction)
      if (next === null) return false
      dispatch({ type: 'file/open', path: next })
      return true
    }

    return {
      toggleViewed: () => {
        if (pr === null || activePath === null) return false
        setViewed({ paths: [activePath], viewed: !viewedPaths.has(activePath) })
        return true
      },
      nextFile: () => move(1),
      prevFile: () => move(-1)
    }
  }, [activePath, pr, viewed, setViewed, dispatch, targetedOrderRef])
}
