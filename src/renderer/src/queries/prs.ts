import {
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import {
  useProjectId,
  useTargetCommit,
  useTargetPath,
  useTargetPr,
  useTargeting,
} from '../state/hooks';
import type { ChannelInput, CheckoutResult, PrSummary, TargetRef } from '@gepard/common';

export function usePrList(search?: string) {
  const projectId = useProjectId() ?? '';
  const commit = useTargetCommit() ?? undefined;
  const path = useTargetPath() ?? undefined;
  return useQuery({
    queryKey: qk.prs(projectId, search, commit, path),
    queryFn: () => invoke('pr.list', { projectId, search, commit, path }),
    enabled: Boolean(projectId),
  });
}

export function usePrCommits() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  const path = useTargetPath() ?? undefined;
  return useQuery({
    queryKey: qk.prCommits(projectId, pr ?? NaN, path),
    queryFn: pr === null ? skipToken : () => invoke('pr.commits', { projectId, pr, path }),
    enabled: Boolean(projectId),
  });
}

export function useCommits(search?: string) {
  const targeting = useTargeting();
  const projectId = useProjectId() ?? '';
  const path = useTargetPath() ?? undefined;
  const usingPr = targeting.pr !== null;
  return useQuery({
    queryKey: qk.commits(projectId, search, path),
    queryFn: () => invoke('commits.list', { projectId, search, path }),
    enabled: !usingPr && Boolean(projectId),
  });
}

export function useBranches() {
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.branches(projectId),
    queryFn: () => invoke('pr.branches', { projectId }),
    enabled: Boolean(projectId),
  });
}

export function useCreatePr() {
  const projectId = useProjectId() ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ChannelInput<'pr.create'>, 'projectId'>) =>
      invoke('pr.create', { projectId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prsAll(projectId) }),
  });
}

export interface CheckoutTarget {
  checkout: (target: TargetRef) => Promise<CheckoutResult>;
  pending: boolean;
}

export function useCheckoutTarget(): CheckoutTarget {
  const projectId = useProjectId() ?? '';
  const qc = useQueryClient();
  const { mutateAsync: checkout } = useMutation({
    mutationKey: qk.checkout(projectId),
    mutationFn: (target: TargetRef) => invoke('pr.checkout', { projectId, target }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.index(projectId) }),
  });
  const pending =
    useMutationState({ filters: { mutationKey: qk.checkout(projectId), status: 'pending' } })
      .length > 0;
  return { checkout, pending };
}

export function useTargetedPr(): PrSummary | null {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  const { data } = useQuery({
    queryKey: qk.prSummary(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('pr.view', { projectId, pr }),
    enabled: Boolean(projectId),
  });
  return data ?? null;
}
