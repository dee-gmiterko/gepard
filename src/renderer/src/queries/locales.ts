import { useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useLocales() {
  return useQuery({ queryKey: qk.locales(), queryFn: () => invoke('locales.list') });
}
