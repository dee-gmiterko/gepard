import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { qk } from './keys'
import type { CommentDraft, LocalViewedState } from '@shared/ipc/schemas/comment'

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
  const key = qk.viewed(projectId, pr)
  return useMutation({
    mutationKey: [...key, 'set'] as const,
    mutationFn: (input: { paths: string[]; viewed: boolean }) =>
      invoke('viewed.set', { projectId, pr, paths: input.paths, viewed: input.viewed }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<LocalViewedState[]>(key)
      qc.setQueryData<LocalViewedState[]>(key, (prev) => {
        const paths = new Set(input.paths)
        const now = new Date().toISOString()
        const next = (prev ?? []).map((v) =>
          paths.has(v.path) ? { ...v, viewed: input.viewed, localUpdatedAt: now } : v
        )
        for (const path of input.paths) {
          if (!next.some((v) => v.path === path)) {
            next.push({
              prId: '',
              path,
              viewed: input.viewed,
              remote: null,
              localUpdatedAt: now,
              remoteFetchedAt: null
            })
          }
        }
        return next
      })
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context) qc.setQueryData(key, context.previous)
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
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
