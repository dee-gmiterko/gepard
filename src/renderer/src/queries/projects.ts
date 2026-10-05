import { useCallback } from 'react';
import {
  skipToken,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { reportQueryError } from '../errors/report';
import { invoke, useIpcEvent } from '../ipc/client';
import { qk } from './keys';
import { useAppDispatch, useAppState } from '../state/AppContext';
import type { ChannelInput, ChannelOutput } from '@gepard/common';

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

export function useLaunch() {
  return useMutation({
    mutationKey: qk.launch(),
    mutationFn: (input: ChannelInput<'app.launch'>) => invoke('app.launch', input),
  });
}

type DetachedLaunch = Extract<ChannelInput<'app.launch'>, { detached: true }>;

function isDetachedLaunch(input: unknown): input is DetachedLaunch {
  return (
    typeof input === 'object' && input !== null && 'detached' in input && input.detached === true
  );
}

export function useLaunchingProjectIds(): string[] {
  return useMutationState({
    filters: { mutationKey: qk.launch(), status: 'pending' },
    select: (mutation) => mutation.state.variables,
  }).flatMap((input) => (isDetachedLaunch(input) ? [input.projectId] : []));
}

type OpenedProject = ChannelOutput<'projects.open'>;

function useOpenHere() {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const [, opened] = await Promise.all([
        qc.invalidateQueries({ queryKey: qk.project(projectId) }),
        invoke('projects.open', { projectId }),
      ]);
      return opened;
    },
    onSuccess: (opened, projectId) => {
      qc.setQueryData<OpenedProject>(qk.open(projectId), opened);
      dispatch({
        type: 'project/open',
        projectId,
        targeting: opened.targeting,
        layout: opened.layout,
      });
    },
  });
}

export function useOpenProject(): (projectId: string, detached: boolean) => void {
  const { mutate: launch } = useLaunch();
  const { mutate: openHere } = useOpenHere();
  return useCallback(
    (projectId: string, detached: boolean) =>
      detached ? launch({ detached: true, projectId }) : openHere(projectId),
    [launch, openHere],
  );
}

export function useOpenedProject() {
  const projectId = useAppState().projectId ?? '';
  return useQuery<OpenedProject>({ queryKey: qk.open(projectId), queryFn: skipToken });
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
  const opened = useOpenedProject();
  return state.checkout?.head ?? opened.data?.head ?? null;
}
