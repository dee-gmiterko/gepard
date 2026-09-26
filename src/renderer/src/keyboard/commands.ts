// One command object built in the shell from AppContext + query data (report
// 04 §7 item 1). Both entry points (window listener, CodeMirror keymap) call
// these; the navigation logic lives here, not in CodeMirror.
import { useMemo } from 'react'
import { useAppDispatch, useAppState } from '../state/AppContext'
import { useSetViewed, useViewed } from '../queries/comments'
import { getTargetedOrder } from './targetedOrder'

export interface Commands {
  toggleViewed: () => void
  nextFile: () => void
  prevFile: () => void
}

/** Enter = toggle viewed; Up/Down = next/prev file in the targeted list, skipping viewed (spec Controls).
 * Viewed state exists only while a PR is targeted (report 04 §4.3); without
 * one, Enter does nothing and Up/Down skip nothing. */
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
      const files = getTargetedOrder()
      const n = files.length
      if (n === 0) return
      const current = activePath === null ? -1 : files.indexOf(activePath)
      // Not in the list: Down starts before the first file, Up after the last.
      const start = current !== -1 ? current : direction === 1 ? -1 : n
      for (let step = 1; step <= n; step++) {
        const i = (((start + direction * step) % n) + n) % n
        if (i === current) return
        if (!viewedPaths.has(files[i])) {
          dispatch({ type: 'file/open', path: files[i] })
          return
        }
      }
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
