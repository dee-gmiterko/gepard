import { useEffect, useRef } from 'react'
import { useAppState } from '../../state/AppContext'
import { useSetTargeting } from '../../queries/projects'

export function usePersistTargeting(): void {
  const state = useAppState()
  const projectId = state.projectId
  const { pr, commit, path } = state.targeting
  const { mutate } = useSetTargeting(projectId ?? '')
  const baselineRef = useRef<{ projectId: string; key: string } | null>(null)

  useEffect(() => {
    if (!projectId) return
    const key = JSON.stringify({ pr, commit, path })

    if (baselineRef.current?.projectId !== projectId) {
      baselineRef.current = { projectId, key }
      return
    }
    if (baselineRef.current.key === key) return

    baselineRef.current = { projectId, key }
    mutate({ pr, commit, path })
  }, [projectId, pr, commit, path, mutate])
}
