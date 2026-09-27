import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { useAppState } from '../state/AppContext'
import { qk } from './keys'
import { matchesTarget } from '@shared/model/paths'

// Git content addressed by a sha never changes, so it can be cached forever.
const immutable = { staleTime: Infinity, gcTime: 10 * 60 * 1000 } as const

export function useTree(projectId: string, sha: string) {
  return useQuery({
    queryKey: qk.tree(projectId, sha),
    queryFn: () => invoke('trees.get', { projectId, sha }),
    enabled: Boolean(projectId) && Boolean(sha),
    ...immutable
  })
}

export function useFileContent(projectId: string, sha: string, path: string) {
  return useQuery({
    queryKey: qk.file(projectId, sha, path),
    queryFn: () => invoke('files.content', { projectId, sha, path }),
    enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    ...immutable
  })
}

export function useChangedFiles(projectId: string, base: string, head: string) {
  return useQuery({
    queryKey: qk.changedFiles(projectId, base, head),
    queryFn: () => invoke('files.changed', { projectId, base, head }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
    ...immutable
  })
}

export function useFileDiff(projectId: string, base: string, head: string, path: string) {
  return useQuery({
    queryKey: qk.fileDiff(projectId, base, head, path),
    queryFn: () => invoke('files.diff', { projectId, base, head, path }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head) && Boolean(path),
    ...immutable
  })
}

export function useTargetedPaths(): string[] {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const path = state.targeting.path
  const { data: changed } = useChangedFiles(
    projectId,
    state.checkout?.base ?? '',
    state.checkout?.head ?? ''
  )

  return useMemo(() => {
    if (changed) {
      const paths = changed.map((f) => f.path)
      return path ? paths.filter((p) => matchesTarget(p, path)) : paths
    }
    return path ? [path] : []
  }, [changed, path])
}
