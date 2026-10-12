import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke, useIpcEvent } from '../ipc/client';
import { qk } from './keys';

export function useOffline(): boolean {
  const qc = useQueryClient();
  useIpcEvent('connectivity.changed', ({ offline }) =>
    qc.setQueryData(qk.connectivity(), { offline }),
  );
  const { data } = useQuery({
    queryKey: qk.connectivity(),
    queryFn: () => invoke('connectivity.get'),
    staleTime: Infinity,
  });
  return data?.offline ?? false;
}
