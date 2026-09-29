import { useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useGrammars() {
  return useQuery({ queryKey: qk.grammars(), queryFn: () => invoke('grammars.list') });
}
