import { skipToken, useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';
import { parseCodeowners, CODEOWNERS_PATHS, type CodeownersRule } from '../helpers/codeowners';

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

async function loadCodeowners(projectId: string, sha: string): Promise<CodeownersRule[] | null> {
  for (const path of CODEOWNERS_PATHS) {
    try {
      const content = await invoke('files.content', { projectId, sha, path });
      if (content.kind === 'text') return parseCodeowners(content.text);
    } catch {
      continue;
    }
  }
  return null;
}

export function useCodeowners(sha: string | undefined) {
  const projectId = useAppState().projectId ?? '';
  return useQuery({
    queryKey: qk.codeowners(projectId, sha ?? ''),
    queryFn: sha ? () => loadCodeowners(projectId, sha) : skipToken,
    enabled: Boolean(projectId) && Boolean(sha),
    staleTime: Infinity,
  });
}
