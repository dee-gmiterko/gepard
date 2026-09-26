import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { qk } from './keys'
import type { ChannelOutput } from '@shared/ipc/contract'
import type { TargetRef } from '@shared/ipc/schemas/pr'

export function usePrList(projectId: string, search?: string) {
  return useQuery({
    queryKey: qk.prs(projectId, search),
    queryFn: () => invoke('pr.list', { projectId, search }),
    enabled: Boolean(projectId)
  })
}

export function usePrCommits(projectId: string, pr: number) {
  return useQuery({
    queryKey: qk.prCommits(projectId, pr),
    queryFn: () => invoke('pr.commits', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr)
  })
}

/** Repository commits for the commit combobox when no PR is set. */
export function useCommits(
  projectId: string,
  opts: { search?: string; path?: string },
  enabled: boolean
) {
  return useQuery({
    queryKey: qk.commits(projectId, opts.search, opts.path),
    queryFn: () => invoke('commits.list', { projectId, ...opts }),
    enabled: enabled && Boolean(projectId)
  })
}

/** Checks out a PR head, a single commit, or (nothing targeted) the default
 * branch head (report 04 §4.2: serialised through main's per-project job
 * queue). The working tree moved, so `projects.open`'s head is updated. */
export function useCheckoutTarget(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (target: TargetRef) => invoke('pr.checkout', { projectId, target }),
    onSuccess: (result) =>
      qc.setQueryData(qk.open(projectId), (prev: ChannelOutput<'projects.open'> | undefined) =>
        prev ? { ...prev, head: result.head } : prev
      ),
    // sha-keyed data is immutable and stays valid; only the index restarts
    onSettled: () => qc.invalidateQueries({ queryKey: qk.index(projectId) })
  })
}
