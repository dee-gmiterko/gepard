import { useMemo } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { invoke } from '../ipc/client';
import { useCheckout, useIsDiffView, useProjectId, useTargetPath } from '../state/hooks';
import { useCurrentHead } from './projects';
import { qk } from './keys';
import { matchesTarget } from '@gepard/common';
import { buildTree, flattenLeafPaths } from '../helpers/tree';

const immutable = { staleTime: Infinity, gcTime: 10 * 60 * 1000 } as const;

export function useTree() {
  const projectId = useProjectId() ?? '';
  const sha = useCurrentHead() ?? '';
  return useQuery({
    queryKey: qk.tree(projectId, sha),
    queryFn: () => invoke('trees.get', { projectId, sha }),
    enabled: Boolean(projectId) && Boolean(sha),
    ...immutable,
  });
}

export function useFileContent(sha: string, path: string) {
  const projectId = useProjectId() ?? '';
  return useQuery({
    queryKey: qk.file(projectId, sha, path),
    queryFn: () => invoke('files.content', { projectId, sha, path }),
    enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    ...immutable,
  });
}

export function changedFilesQuery(projectId: string, base: string, head: string) {
  return queryOptions({
    queryKey: qk.changedFiles(projectId, base, head),
    queryFn: () => invoke('files.changed', { projectId, base, head }),
    ...immutable,
  });
}

export function useChangedFiles() {
  const checkout = useCheckout();
  const projectId = useProjectId() ?? '';
  const base = checkout?.base ?? '';
  const head = checkout?.head ?? '';
  return useQuery({
    ...changedFilesQuery(projectId, base, head),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head),
  });
}

export function useFileDiff(path: string) {
  const checkout = useCheckout();
  const projectId = useProjectId() ?? '';
  const base = checkout?.base ?? '';
  const head = checkout?.head ?? '';
  return useQuery({
    queryKey: qk.fileDiff(projectId, base, head, path),
    queryFn: () => invoke('files.diff', { projectId, base, head, path }),
    enabled: Boolean(projectId) && Boolean(base) && Boolean(head) && Boolean(path),
    ...immutable,
  });
}

export function useTargetedFiles(): string[] {
  const path = useTargetPath();
  const diffMode = useIsDiffView();
  const { data: changed } = useChangedFiles();
  const tree = useTree();

  return useMemo(() => {
    const paths = diffMode ? (changed ?? []).map((f) => f.path) : path ? (tree.data ?? []) : [];
    return targetedFilePaths(paths, path);
  }, [diffMode, changed, path, tree.data]);
}

/** Scopes `paths` to the path target and orders them as the targeted file tree lists them. */
export function targetedFilePaths(paths: readonly string[], path: string | null): string[] {
  const scoped = path ? paths.filter((p) => matchesTarget(p, path)) : paths;
  return flattenLeafPaths(buildTree(scoped.map((p) => ({ path: p, data: null }))));
}
