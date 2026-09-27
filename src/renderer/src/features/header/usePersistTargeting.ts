import { useEffect, useRef } from 'react'
import { useAppState } from '../../state/AppContext'
import { useSetTargeting } from '../../queries/projects'

export function usePersistTargeting(): void {
  const state = useAppState()
  const projectId = state.projectId
  const { pr, commit, path } = state.targeting
  const { mutate } = useSetTargeting(projectId ?? '')
  const lastRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    const key = JSON.stringify({ pr, commit, path })
    if (lastRef.current === key) return
    lastRef.current = key
    mutate({ pr, commit, path })
  }, [projectId, pr, commit, path, mutate])
}
