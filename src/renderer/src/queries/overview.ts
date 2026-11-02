import { skipToken, useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useOverviewPr, useProjectId } from '../state/hooks';
import { changedFilesQuery } from './files';

// GitHub computes mergeability lazily and reports UNKNOWN until it has finished.
const MERGEABILITY_POLL_MS = 3000;

export function useProjectOverview() {
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.projectOverview(projectId),
    queryFn: () => invoke('overview.project', { projectId }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.prs.some((p) => p.mergeReadiness.state === 'CHECKING')
        ? MERGEABILITY_POLL_MS
        : false,
  });
}

export function usePrOverviewDetails() {
  const projectId = useProjectId() ?? '';
  const pr = useOverviewPr();
  return useQuery({
    queryKey: qk.prOverview(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('overview.pr', { projectId, pr }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.state === 'OPEN' && query.state.data.mergeReadiness.state === 'CHECKING'
        ? MERGEABILITY_POLL_MS
        : false,
  });
}

export function useOverviewRange() {
  const projectId = useProjectId() ?? '';
  const pr = useOverviewPr();
  return useQuery({
    queryKey: qk.prRange(projectId, pr ?? NaN),
    queryFn: pr === null ? skipToken : () => invoke('overview.range', { projectId, pr }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useOverviewChangedFiles() {
  const projectId = useProjectId() ?? '';
  const { data } = useOverviewRange();
  const base = data?.base ?? '';
  const head = data?.head ?? '';
  return useQuery({
    ...changedFilesQuery(projectId, base, head),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
  });
}

export function useChangedFileOwners() {
  const projectId = useProjectId() ?? '';
  const { data } = useOverviewRange();
  const base = data?.base ?? '';
  const head = data?.head ?? '';
  return useQuery({
    queryKey: qk.changedFileOwners(projectId, base, head),
    queryFn: () => invoke('overview.owners', { projectId, base, head }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
    staleTime: Infinity,
  });
}
