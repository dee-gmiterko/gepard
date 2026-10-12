import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useExtensions() {
  return useQuery({ queryKey: qk.extensions(), queryFn: () => invoke('extensions.list') });
}

export function useSetExtensionEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      invoke('extensions.setEnabled', { id, enabled }),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.extensions() }),
        qc.invalidateQueries({ queryKey: qk.grammars() }),
      ]),
  });
}

function invalidateInstalled(qc: ReturnType<typeof useQueryClient>): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.extensions() }),
    qc.invalidateQueries({ queryKey: qk.extensionCatalog() }),
    qc.invalidateQueries({ queryKey: qk.grammars() }),
  ]);
}

export function useExtensionCatalog() {
  return useQuery({
    queryKey: qk.extensionCatalog(),
    queryFn: () => invoke('extensions.catalog'),
    staleTime: 5 * 60_000,
  });
}

export function useInstallFromCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => invoke('extensions.installFromCatalog', input),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () => invalidateInstalled(qc),
  });
}

export function useInstallFromRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { repository: string; path: string | null }) =>
      invoke('extensions.installFromRepo', input),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () => invalidateInstalled(qc),
  });
}

export function useExtensionsDir() {
  return useQuery({ queryKey: qk.extensionsDir(), queryFn: () => invoke('extensions.dir') });
}

// A cancelled native file-picker dialog resolves with no file chosen instead
// of rejecting.
export function useInstallExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dialogTitle: string }) => invoke('extensions.install', input),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.extensions() }),
        qc.invalidateQueries({ queryKey: qk.grammars() }),
      ]),
  });
}
