import { skipToken, useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';

export function useProjectOverview() {
  const projectId = useAppState().projectId ?? '';
  return useQuery({
    queryKey: qk.projectOverview(projectId),
    queryFn: () => invoke('overview.project', { projectId }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function usePrOverviewDetails() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const pr = state.targeting.pr;
  return useQuery({
    queryKey: qk.prOverview(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('overview.pr', { projectId, pr }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useChangedFileOwners() {
  const state = useAppState();
  const projectId = state.projectId ?? '';
  const base = state.checkout?.base ?? '';
  const head = state.checkout?.head ?? '';
  return useQuery({
    queryKey: qk.changedFileOwners(projectId, base, head),
    queryFn: () => invoke('overview.owners', { projectId, base, head }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
    staleTime: Infinity,
  });
}
