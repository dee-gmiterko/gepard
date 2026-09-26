// Query functions are one-liners around invoke() (report 04 §5.1).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke, useIpcEvent } from '../ipc/client'
import { qk } from './keys'
import { useAppState } from '../state/AppContext'
import type { ChannelInput } from '@shared/ipc/contract'

export function useViewer() {
  return useQuery({ queryKey: qk.viewer(), queryFn: () => invoke('app.viewer') })
}

export function useProjects() {
  return useQuery({ queryKey: qk.projects(), queryFn: () => invoke('projects.list') })
}

export function useAddProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ChannelInput<'projects.add'>) => invoke('projects.add', input),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.projects() })
  })
}

/** Opening a project starts its background index and yields the current head sha. */
export function useOpenProject(projectId: string | null) {
  return useQuery({
    queryKey: qk.open(projectId ?? ''),
    queryFn: () => invoke('projects.open', { projectId: projectId! }),
    enabled: Boolean(projectId),
    staleTime: Infinity
  })
}

export function useCloneStart() {
  return useMutation({
    mutationFn: (projectId: string) => invoke('clone.start', { projectId })
  })
}

/** Launchpad remove. */
export function useRemoveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => invoke('projects.remove', { projectId }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.projects() })
  })
}

/** Background index status: initial value from `index.get`, then live from
 * the `index.status` event. When indexing settles, queries that failed while
 * the language session was not up yet (symbols, references) are retried. */
export function useIndexStatus(projectId: string) {
  const qc = useQueryClient()
  useIpcEvent('index.status', (payload) => {
    if (payload.projectId !== projectId) return
    qc.setQueryData(qk.index(projectId), payload.status)
    if (payload.status.state === 'idle') {
      qc.invalidateQueries({
        queryKey: qk.project(projectId),
        predicate: (q) => q.state.status === 'error'
      })
    }
    // An 'error' status is toasted by the always-mounted subscription in
    // main.tsx, not here: this hook only listens for the project currently
    // shown, and a background index can fail after the user switched away.
  })
  return useQuery({
    queryKey: qk.index(projectId),
    queryFn: () => invoke('index.get', { projectId }),
    enabled: Boolean(projectId)
  })
}

/** The sha the file browser and folder-targeting combobox read at: the
 * checked-out target's head once one exists, else the project's initial open
 * head (report 04 §5.1: `projects.open` "the file browser uses before any
 * PR/commit is targeted"). Composes `useOpenProject` with AppContext's
 * `checkout`, so header and side-panel features share one head resolution. */
export function useCurrentHead(projectId: string | null): string | null {
  const state = useAppState()
  const open = useOpenProject(projectId)
  return state.checkout?.head ?? open.data?.head ?? null
}
