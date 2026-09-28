import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useLocales() {
  return useQuery({ queryKey: qk.locales(), queryFn: () => invoke('locales.list') });
}

export function useLocaleId() {
  return useQuery({ queryKey: qk.localeId(), queryFn: () => invoke('locale.getLocaleId') });
}

export function useSetLocale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (localeId: string | null) => invoke('locale.setLocaleId', { localeId }),
    onSuccess: (localeId) => qc.setQueryData(qk.localeId(), localeId),
  });
}
