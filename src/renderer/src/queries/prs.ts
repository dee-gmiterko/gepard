import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';
import type { ChannelInput, PrSummary, TargetRef } from '@gepard/common';

export function usePrList(search?: string) {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const commit = state.targeting.commit ?? undefined;
  const path = state.targeting.path ?? undefined;
  return useQuery({
    queryKey: qk.prs(projectId, search, commit, path),
    queryFn: () => invoke('pr.list', { projectId, search, commit, path }),
    enabled: Boolean(projectId),
  });
}

export function usePrCommits() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr;
  const path = state.targeting.path ?? undefined;
  return useQuery({
    queryKey: qk.prCommits(projectId, pr ?? NaN, path),
    queryFn: pr === null ? skipToken : () => invoke('pr.commits', { projectId, pr, path }),
    enabled: Boolean(projectId),
  });
}

export function useCommits(search?: string) {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const path = state.targeting.path ?? undefined;
  const usingPr = state.targeting.pr !== null;
  return useQuery({
    queryKey: qk.commits(projectId, search, path),
    queryFn: () => invoke('commits.list', { projectId, search, path }),
    enabled: !usingPr && Boolean(projectId),
  });
}

export function useBranches() {
  const projectId = useAppState().projectId ?? '';
  return useQuery({
    queryKey: qk.branches(projectId),
    queryFn: () => invoke('pr.branches', { projectId }),
    enabled: Boolean(projectId),
  });
}

export function useCreatePr() {
  const projectId = useAppState().projectId ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ChannelInput<'pr.create'>, 'projectId'>) =>
      invoke('pr.create', { projectId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prsAll(projectId) }),
  });
}

export function useCheckoutTarget() {
  const projectId = useAppState().projectId ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: TargetRef) => invoke('pr.checkout', { projectId, target }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.index(projectId) }),
  });
}

export function useTargetedPr(): PrSummary | null {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr;
  const { data } = useQuery({
    queryKey: qk.prSummary(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('pr.view', { projectId, pr }),
    enabled: Boolean(projectId),
  });
  return data ?? null;
}
