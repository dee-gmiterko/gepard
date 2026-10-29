import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { useProjectId } from '../state/hooks';
import { qk } from './keys';

const FILE_LIST_KEYS = new Set(['tree', 'diff', 'owners']);

export function useGlobalHiddenFiles() {
  return useQuery({
    queryKey: qk.hiddenFilesGlobal(),
    queryFn: () => invoke('hiddenFiles.getGlobal'),
  });
}

export function useProjectHiddenFiles() {
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.hiddenFilesProject(projectId),
    queryFn: () => invoke('hiddenFiles.getProject', { projectId }),
    enabled: Boolean(projectId),
  });
}

function useInvalidateFileLists(): () => Promise<void> {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: qk.all,
      predicate: (q) =>
        q.queryKey.some((part) => typeof part === 'string' && FILE_LIST_KEYS.has(part)),
    });
}

export function useSetGlobalHiddenFiles() {
  const qc = useQueryClient();
  const invalidateFileLists = useInvalidateFileLists();
  return useMutation({
    mutationFn: (patterns: string[]) => invoke('hiddenFiles.setGlobal', { patterns }),
    onSuccess: async (patterns) => {
      qc.setQueryData(qk.hiddenFilesGlobal(), patterns);
      await invalidateFileLists();
    },
  });
}

export function useSetProjectHiddenFiles() {
  const projectId = useProjectId() ?? '';
  const qc = useQueryClient();
  const invalidateFileLists = useInvalidateFileLists();
  return useMutation({
    mutationFn: (patterns: string[]) => invoke('hiddenFiles.setProject', { projectId, patterns }),
    onSuccess: async (patterns) => {
      qc.setQueryData(qk.hiddenFilesProject(projectId), patterns);
      await invalidateFileLists();
    },
  });
}
