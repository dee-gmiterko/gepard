import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useAppDispatch, useAppState } from '../state/AppContext';
import { useTargetedPr } from './prs';
import type { CommentDraft, LocalViewedState, SyncMode } from '@gepard/common';

export function useComments() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  return useQuery({
    queryKey: qk.comments(projectId, pr),
    queryFn: () => invoke('comments.list', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr),
  });
}

export function useViewed() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  return useQuery({
    queryKey: qk.viewed(projectId, pr),
    queryFn: () => invoke('viewed.list', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr),
  });
}

export type CommentDraftBody = Omit<CommentDraft, 'projectId' | 'pr' | 'prId'>;

export function useUpsertComment() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  const prId = useTargetedPr()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: CommentDraftBody) =>
      invoke('comments.upsert', { ...draft, projectId, pr, prId }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.comments(projectId, pr) }),
        qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) }),
      ]),
  });
}

export function useDeleteComment() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => invoke('comments.delete', { projectId, pr, commentId }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.comments(projectId, pr) }),
        qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) }),
      ]),
  });
}

export function useSetViewed() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  const prId = useTargetedPr()?.id ?? null;
  const qc = useQueryClient();
  const key = qk.viewed(projectId, pr);
  return useMutation({
    mutationKey: [...key, 'set'] as const,
    mutationFn: (input: { paths: string[]; viewed: boolean }) =>
      invoke('viewed.set', { projectId, pr, paths: input.paths, viewed: input.viewed, prId }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LocalViewedState[]>(key);
      qc.setQueryData<LocalViewedState[]>(key, (prev) => {
        const paths = new Set(input.paths);
        const now = new Date().toISOString();
        const next = (prev ?? []).map((v) =>
          paths.has(v.path) ? { ...v, viewed: input.viewed, localUpdatedAt: now } : v,
        );
        for (const path of input.paths) {
          if (!next.some((v) => v.path === path)) {
            next.push({
              prId: '',
              path,
              viewed: input.viewed,
              remote: null,
              localUpdatedAt: now,
              remoteFetchedAt: null,
            });
          }
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context) qc.setQueryData(key, context.previous);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) }),
      ]),
  });
}

export function useSync() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: SyncMode = 'full') => invoke('sync.run', { projectId, pr, mode }),
    onSuccess: (result) => {
      dispatch({
        type: 'target/checkoutResult',
        checkout: { base: result.base, head: result.head },
      });
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.pr(projectId, pr) }),
        qc.invalidateQueries({ queryKey: qk.index(projectId) }),
      ]),
  });
}

export function usePendingCount() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr ?? NaN;
  return useQuery({
    queryKey: qk.pendingCount(projectId, pr),
    queryFn: () => invoke('sync.pendingCount', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr),
  });
}
