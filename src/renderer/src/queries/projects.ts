import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportQueryError } from '../errors/report';
import { invoke, useIpcEvent } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';
import type { ChannelInput } from '@gepard/common';

export function useViewer() {
  return useQuery({ queryKey: qk.viewer(), queryFn: () => invoke('app.viewer') });
}

export function useViewerRepos() {
  return useQuery({ queryKey: qk.viewerRepos(), queryFn: () => invoke('app.viewerRepos') });
}

export function useProjects() {
  return useQuery({ queryKey: qk.projects(), queryFn: () => invoke('projects.list') });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChannelInput<'projects.add'>) => invoke('projects.add', input),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.projects() }),
  });
}

export function useOpenProject() {
  const projectId = useAppState().projectId;
  return useQuery({
    queryKey: qk.open(projectId ?? ''),
    queryFn: projectId ? () => invoke('projects.open', { projectId }) : skipToken,
    staleTime: Infinity,
  });
}

export function useSetTargeting() {
  const projectId = useAppState().projectId ?? '';
  return useMutation({
    mutationFn: (targeting: ChannelInput<'projects.setTargeting'>['targeting']) =>
      invoke('projects.setTargeting', { projectId, targeting }),
  });
}

export function useSetLayout() {
  const projectId = useAppState().projectId ?? '';
  return useMutation({
    mutationFn: (layout: ChannelInput<'projects.setLayout'>['layout']) =>
      invoke('projects.setLayout', { projectId, layout }),
  });
}

export function useCloneStart() {
  return useMutation({
    mutationFn: (projectId: string) => invoke('clone.start', { projectId }),
  });
}

export function useRemoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => invoke('projects.remove', { projectId }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.projects() }),
  });
}

export function useFetchProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => invoke('projects.fetch', { projectId }),
    onSuccess: (_data, projectId) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.prsAll(projectId) }),
        qc.invalidateQueries({ queryKey: qk.branches(projectId) }),
        qc.invalidateQueries({ queryKey: qk.commitsAll(projectId) }),
      ]),
  });
}

export function useIndexStatus() {
  const projectId = useAppState().projectId ?? '';
  const qc = useQueryClient();
  useIpcEvent('index.status', (payload) => {
    if (payload.projectId !== projectId) return;
    qc.setQueryData(qk.index(projectId), payload.status);
    if (payload.status.state === 'idle') {
      qc.invalidateQueries({
        queryKey: qk.project(projectId),
        predicate: (q) => q.state.status === 'error',
      }).catch((error: unknown) => reportQueryError('index.status', error));
    }
  });
  return useQuery({
    queryKey: qk.index(projectId),
    queryFn: () => invoke('index.get', { projectId }),
    enabled: Boolean(projectId),
  });
}

const LANGUAGE_SERVERS_POLL_MS = 2000;

export function useLanguageServers() {
  const projectId = useAppState().projectId ?? '';
  return useQuery({
    queryKey: qk.languageServers(projectId),
    queryFn: () => invoke('index.languages', { projectId }),
    enabled: Boolean(projectId),
    refetchOnMount: 'always',
    refetchInterval: LANGUAGE_SERVERS_POLL_MS,
  });
}

export function useCurrentHead(): string | null {
  const state = useAppState();
  const open = useOpenProject();
  return state.checkout?.head ?? open.data?.head ?? null;
}
