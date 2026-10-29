import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { useProjectId } from '../state/hooks';
import { qk, type HiddenFilesScope } from './keys';

const FILE_LIST_KEYS = new Set(['tree', 'diff', 'owners']);

type HiddenFilesTarget = { scope: 'global' } | { scope: 'project'; projectId: string };

function useTarget(scope: HiddenFilesScope): {
  target: HiddenFilesTarget;
  key: readonly unknown[];
} {
  const projectId = useProjectId() ?? '';
  return scope === 'global'
    ? { target: { scope }, key: qk.hiddenFiles(scope, '') }
    : { target: { scope, projectId }, key: qk.hiddenFiles(scope, projectId) };
}

export function useHiddenFiles(scope: HiddenFilesScope) {
  const { target, key } = useTarget(scope);
  return useQuery({
    queryKey: key,
    queryFn: () => invoke('hiddenFiles.get', target),
    enabled: target.scope === 'global' || Boolean(target.projectId),
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

export function useSetHiddenFiles(scope: HiddenFilesScope) {
  const { target, key } = useTarget(scope);
  const qc = useQueryClient();
  const invalidateFileLists = useInvalidateFileLists();
  return useMutation({
    mutationFn: (patterns: string[]) => invoke('hiddenFiles.set', { ...target, patterns }),
    onSuccess: async (patterns) => {
      qc.setQueryData(key, patterns);
      await invalidateFileLists();
    },
  });
}
