import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExtensionInstallSource } from '@gepard/common';
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

export function useExtensionsDir() {
  return useQuery({ queryKey: qk.extensionsDir(), queryFn: () => invoke('extensions.dir') });
}

// A cancelled native file-picker dialog resolves with no file chosen instead
// of rejecting.
export function useInstallExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: ExtensionInstallSource) => invoke('extensions.install', source),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () => invalidateInstalled(qc),
  });
}
