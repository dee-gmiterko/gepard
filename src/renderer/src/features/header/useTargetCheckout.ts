import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { useCheckoutTarget } from '../../queries/prs'
import { useOpenProject } from '../../queries/projects'
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
  const open = useOpenProject(projectId)

  const checkout = useCheckoutTarget(projectId ?? '')
  const sync = useSync(projectId ?? '', pr ?? NaN)

  const checkoutRef = useRef(checkout)
  const syncRef = useRef(sync)
  useLayoutEffect(() => {
    checkoutRef.current = checkout
    syncRef.current = sync
  })

  const restoredFor = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || !open.data) return

    if (restoredFor.current !== projectId) {
      restoredFor.current = projectId
      const persisted = open.data.targeting
      if (persisted.pr !== null || persisted.commit !== null || persisted.path !== null) {
        dispatch({ type: 'target/restore', targeting: persisted })
        return
      }
    }

    const active = activeTargetRef({ pr, commit })
    const target: TargetRef = active ?? { kind: 'default' }

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
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [projectId, open.data, pr, commit, dispatch])

  return { pending: checkout.isPending || sync.isPending }
}
