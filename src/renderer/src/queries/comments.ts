import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { qk } from './keys'
import type { CommentDraft } from '@shared/ipc/schemas/comment'

export function useComments(projectId: string, pr: number) {
  return useQuery({
    queryKey: qk.comments(projectId, pr),
    queryFn: () => invoke('comments.list', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr)
  })
}

export function useViewed(projectId: string, pr: number) {
  return useQuery({
    queryKey: qk.viewed(projectId, pr),
    queryFn: () => invoke('viewed.list', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr)
  })
}

export function useUpsertComment(projectId: string, pr: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: CommentDraft) => invoke('comments.upsert', draft),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.comments(projectId, pr) })
      qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) })
    }
  })
}

export function useDeleteComment(projectId: string, pr: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => invoke('comments.delete', { projectId, pr, commentId }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.comments(projectId, pr) })
      qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) })
    }
  })
}

export function useSetViewed(projectId: string, pr: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...qk.viewed(projectId, pr), 'set'] as const,
    mutationFn: (input: { paths: string[]; viewed: boolean }) =>
      invoke('viewed.set', { projectId, pr, paths: input.paths, viewed: input.viewed }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.viewed(projectId, pr) })
      qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) })
    }
  })
}

export function useSync(projectId: string, pr: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: 'full' | 'pull' = 'full') => invoke('sync.run', { projectId, pr, mode }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pr(projectId, pr) })
  })
}

export function usePendingCount(projectId: string, pr: number) {
  return useQuery({
    queryKey: qk.pendingCount(projectId, pr),
    queryFn: () => invoke('sync.pendingCount', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr)
  })
}
