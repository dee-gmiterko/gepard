import { useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { qk } from './keys';
import { useCheckoutHead, useProjectId } from '../state/hooks';

const ANNOTATIONS_STALE_MS = 30_000;

export function useFileAnnotations(path: string) {
  const projectId = useProjectId() ?? '';
  const sha = useCheckoutHead()?.head ?? '';
  return useQuery({
    queryKey: qk.fileAnnotations(projectId, sha, path),
    queryFn: () => invoke('checks.annotations', { projectId, sha, path }),
    enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    staleTime: ANNOTATIONS_STALE_MS,
  });
}
