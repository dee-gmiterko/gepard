import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useUiDispatch } from '../state/UiContext';
import { useProjectId, useTargetCommit, useTargetPr } from '../state/hooks';
import { useTargetedPr } from './prs';
import type { ChannelInput, CommentDraft, LocalViewedState, SyncMode } from '@gepard/common';

function commentsKey(projectId: string, pr: number | null) {
  return pr === null ? qk.unassignedComments(projectId) : qk.comments(projectId, pr);
}

export function useComments() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  return useQuery({
    queryKey: commentsKey(projectId, pr),
    queryFn: () => invoke('comments.list', { projectId, pr }),
    enabled: Boolean(projectId),
  });
}

export function viewedQuery(projectId: string, pr: number) {
  return queryOptions({
    queryKey: qk.viewed(projectId, pr),
    queryFn: () => invoke('viewed.list', { projectId, pr }),
  });
}

export function useViewed() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr() ?? NaN;
  return useQuery({
    ...viewedQuery(projectId, pr),
    enabled: Boolean(projectId) && Number.isFinite(pr),
  });
}

export type CommentDraftBody = Omit<CommentDraft, 'projectId' | 'pr' | 'prId'>;

function invalidateComments(
  qc: QueryClient,
  projectId: string,
  pr: number | null,
): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: commentsKey(projectId, pr) }),
    pr !== null && qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) }),
  ]);
}

export function useUpsertComment() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  const prId = useTargetedPr()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: CommentDraftBody) =>
      invoke('comments.upsert', { ...draft, projectId, pr, prId }),
    onSettled: () => invalidateComments(qc, projectId, pr),
  });
}

export function useDeleteComment() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => invoke('comments.delete', { projectId, pr, commentId }),
    onSettled: () => invalidateComments(qc, projectId, pr),
  });
}

export function useCreateIssue() {
  const projectId = useProjectId() ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ChannelInput<'issues.create'>, 'projectId'>) =>
      invoke('issues.create', { projectId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.unassignedComments(projectId) }),
  });
}

export function useSetViewed() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr() ?? NaN;
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
      // An older response would overwrite the optimistic state of marks still in flight.
      if (qc.isMutating({ mutationKey: [...key, 'set'] }) <= 1) qc.setQueryData(key, data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pendingCount(projectId, pr) }),
  });
}

export function useSync() {
  const dispatch = useUiDispatch();
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr() ?? NaN;
  const commit = useTargetCommit() ?? undefined;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: SyncMode = 'full') => ({
      pr,
      commit,
      ...(await invoke('sync.run', { projectId, pr, commit, mode })),
    }),
    onSuccess: (result) => {
      dispatch({
        type: 'target/checkoutHeadResult',
        checkoutHead: { base: result.base, head: result.head },
        for: { pr: result.pr, commit: result.commit ?? null },
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
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr() ?? NaN;
  return useQuery({
    queryKey: qk.pendingCount(projectId, pr),
    queryFn: () => invoke('sync.pendingCount', { projectId, pr }),
    enabled: Boolean(projectId) && Number.isFinite(pr),
  });
}
