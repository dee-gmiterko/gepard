import { useAppDispatch, useAppState } from '../../state/AppContext'
import { useSetTargeting } from '../../queries/projects'
import type { AppAction, Targeting } from '../../state/reducer'

export interface TargetActions {
  setPr: (pr: number | null) => void
  setCommit: (sha: string | null) => void
  setPath: (path: string | null) => void
}

export function useTargetActions(): TargetActions {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const setTargeting = useSetTargeting()

  function apply(action: AppAction, targeting: Targeting): void {
    dispatch(action)
    setTargeting.mutate(targeting)
  }

  return {
    setPr: (pr) =>
      apply({ type: 'target/pr', pr }, { pr, commit: null, path: state.targeting.path }),
    setCommit: (sha) => apply({ type: 'target/commit', sha }, { ...state.targeting, commit: sha }),
    setPath: (path) => apply({ type: 'target/path', path }, { ...state.targeting, path })
  }
}
