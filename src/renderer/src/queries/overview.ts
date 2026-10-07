import { skipToken, useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useCheckout, useProjectId, useTargetPr } from '../state/hooks';

export function useProjectOverview() {
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.projectOverview(projectId),
    queryFn: () => invoke('overview.project', { projectId }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function usePrOverviewDetails() {
  const projectId = useProjectId() ?? '';
  const pr = useTargetPr();
  return useQuery({
    queryKey: qk.prOverview(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('overview.pr', { projectId, pr }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useChangedFileOwners() {
  const checkout = useCheckout();
  const projectId = useProjectId() ?? '';
  const base = checkout?.base ?? '';
  const head = checkout?.head ?? '';
  return useQuery({
    queryKey: qk.changedFileOwners(projectId, base, head),
    queryFn: () => invoke('overview.owners', { projectId, base, head }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
    staleTime: Infinity,
  });
}
