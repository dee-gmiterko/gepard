import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { qk } from './keys'
import type { ChannelInput, ChannelOutput } from '@shared/ipc/contract'
import type { TargetRef } from '@shared/ipc/schemas/pr'

export function usePrList(projectId: string, search?: string, commit?: string, path?: string) {
  return useQuery({
    queryKey: qk.prs(projectId, search, commit, path),
    queryFn: () => invoke('pr.list', { projectId, search, commit, path }),
    enabled: Boolean(projectId)
  })
}

export function usePrCommits(projectId: string, pr: number, path?: string) {
  return useQuery({
    queryKey: qk.prCommits(projectId, pr, path),
    queryFn: () => invoke('pr.commits', { projectId, pr, path }),
    enabled: Boolean(projectId) && Number.isFinite(pr)
  })
}

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

export function useBranches(projectId: string) {
  return useQuery({
    queryKey: qk.branches(projectId),
    queryFn: () => invoke('pr.branches', { projectId }),
    enabled: Boolean(projectId)
  })
}

export function useCreatePr(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<ChannelInput<'pr.create'>, 'projectId'>) =>
      invoke('pr.create', { projectId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prsAll(projectId) })
  })
}

export function useCheckoutTarget(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (target: TargetRef) => invoke('pr.checkout', { projectId, target }),
    onSuccess: (result) =>
      qc.setQueryData(qk.open(projectId), (prev: ChannelOutput<'projects.open'> | undefined) =>
        prev ? { ...prev, head: result.head } : prev
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.index(projectId) })
  })
}
