// This feature owns the side effects of a target change (spec Behaviors:
// "Changing PR or commit checks out that version in working tree ... fetches
// remote comments and viewed state"). Runs whenever the PR or commit target
// changes; with neither targeted it checks out the default branch head.
// Folder targeting never checks out.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { useCheckoutTarget } from '../../queries/prs'
import { useSync } from '../../queries/comments'
import { activeTargetRef } from '../../state/selectors'
import type { TargetRef } from '@shared/ipc/schemas/pr'

export interface TargetCheckoutStatus {
  pending: boolean
}

export function useTargetCheckoutEffect(): TargetCheckoutStatus {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId
  const { pr, commit } = state.targeting

  const checkout = useCheckoutTarget(projectId ?? '')
  const sync = useSync(projectId ?? '', pr ?? NaN)

  // Mutation objects get a new identity every render; read the latest one
  // through a ref so the effect below only re-runs when the target itself
  // changes, not on every render.
  const checkoutRef = useRef(checkout)
  const syncRef = useRef(sync)
  useLayoutEffect(() => {
    checkoutRef.current = checkout
    syncRef.current = sync
  })

  useEffect(() => {
    if (!projectId) return

    // Commit wins over PR (selectors.ts activeTargetRef): a commit picked
    // while a PR is set is one of that PR's commits. Neither targeted: the
    // default branch head, which has no diff (the checkout state stays null).
    const active = activeTargetRef({ pr, commit })
    const target: TargetRef = active ?? { kind: 'default' }

    // The previous target's base/head no longer describe what is shown.
    dispatch({ type: 'target/checkoutResult', checkout: null })
    syncRef.current.reset()

    let cancelled = false
    checkoutRef.current
      .mutateAsync(target)
      .then((result) => {
        if (cancelled || !active) return
        dispatch({ type: 'target/checkoutResult', checkout: result })
        if (pr !== null) syncRef.current.mutate('pull')
      })
      .catch(() => {
        // Reported to the unified toast surface by the global mutation
        // cache (main.tsx) — nothing left to do with it here.
      })

    return () => {
      cancelled = true
    }
  }, [projectId, pr, commit, dispatch])

  return { pending: checkout.isPending || sync.isPending }
}
