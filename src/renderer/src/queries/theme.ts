import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';

export function useThemes() {
  return useQuery({ queryKey: qk.themes(), queryFn: () => invoke('themes.list') });
}

export function useThemeTemplateId() {
  return useQuery({ queryKey: qk.themeTemplate(), queryFn: () => invoke('theme.getTemplateId') });
}

export function useSetThemeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string | null) => invoke('theme.setTemplateId', { templateId }),
    onSuccess: (templateId) => qc.setQueryData(qk.themeTemplate(), templateId),
  });
}
