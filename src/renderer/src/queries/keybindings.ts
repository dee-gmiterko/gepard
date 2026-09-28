import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useKeybindingOverrides() {
  return useQuery({
    queryKey: qk.keybindingOverrides(),
    queryFn: () => invoke('keybindings.getOverrides'),
  });
}

export function useSetKeybindingOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; key: string | null }) =>
      invoke('keybindings.setOverride', args),
    onSuccess: (overrides) => qc.setQueryData(qk.keybindingOverrides(), overrides),
  });
}
