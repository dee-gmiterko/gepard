import { useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useLogPath() {
  return useQuery({ queryKey: qk.logPath(), queryFn: () => invoke('log.getPath') });
}
