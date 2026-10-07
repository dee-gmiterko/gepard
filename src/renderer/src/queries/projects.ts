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
import { useAppDispatch } from '../state/AppContext';
import { useCheckoutHead, useProjectId } from '../state/hooks';
import type { ChannelInput, OpenedProject } from '@gepard/common';

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

export function useStartup() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.startup(),
    queryFn: async () => {
      const opened = await invoke('app.startup');
      if (opened) qc.setQueryData<OpenedProject>(qk.open(opened.project.id), opened);
      return opened;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

type LaunchInput = ChannelInput<'app.launch'>;

function isLaunchInput(input: unknown): input is LaunchInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'projectId' in input &&
    (typeof input.projectId === 'string' || input.projectId === null) &&
    'detached' in input &&
    typeof input.detached === 'boolean'
  );
}

export function useOpenProject() {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationKey: qk.launch(),
    mutationFn: (input: LaunchInput) => invoke('app.launch', input),
    onSuccess: (opened) => {
      if (!opened) return;
      const projectId = opened.project.id;
      void qc.invalidateQueries({ queryKey: qk.project(projectId) });
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

export function useLaunchingProjectIds(): (string | null)[] {
  return useMutationState({
    filters: { mutationKey: qk.launch(), status: 'pending' },
    select: (mutation) => mutation.state.variables,
  }).flatMap((input) => (isLaunchInput(input) && input.detached ? [input.projectId] : []));
}

export function useOpenedProject() {
  const projectId = useProjectId() ?? '';
  return useQuery<OpenedProject>({ queryKey: qk.open(projectId), queryFn: skipToken });
}

export function useSetTargeting() {
  const projectId = useProjectId() ?? '';
  return useMutation({
    mutationFn: (targeting: ChannelInput<'projects.setTargeting'>['targeting']) =>
      invoke('projects.setTargeting', { projectId, targeting }),
  });
}

export function useSetLayout() {
  const projectId = useProjectId() ?? '';
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
  const projectId = useProjectId() ?? '';
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
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.languageServers(projectId),
    queryFn: () => invoke('index.languages', { projectId }),
    enabled: Boolean(projectId),
    refetchOnMount: 'always',
    refetchInterval: LANGUAGE_SERVERS_POLL_MS,
  });
}

export function useCurrentHead(): string | null {
  const checkoutHead = useCheckoutHead();
  const opened = useOpenedProject();
  return checkoutHead?.head ?? opened.data?.head ?? null;
}
