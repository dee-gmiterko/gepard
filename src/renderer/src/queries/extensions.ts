import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '../ipc/client'
import { qk } from './keys'

export function useExtensions() {
  return useQuery({ queryKey: qk.extensions(), queryFn: () => invoke('extensions.list') })
}

export function useSetExtensionEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      invoke('extensions.setEnabled', { id, enabled }),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.extensions() })
  })
}

export function useExtensionsDir() {
  return useQuery({ queryKey: qk.extensionsDir(), queryFn: () => invoke('extensions.dir') })
}

// A cancelled native file-picker dialog resolves with no file chosen instead
// of rejecting.
export function useInstallExtension() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { dialogTitle: string; filterName: string }) =>
      invoke('extensions.install', input),
    onSuccess: (extensions) => qc.setQueryData(qk.extensions(), extensions),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.extensions() })
  })
}
