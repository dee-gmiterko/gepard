import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke, isCancelledError } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';
import { useCurrentHead } from './projects';
import { digestPaths } from '../helpers/pathsDigest';
import type { SearchQuery } from '@gepard/common/ipc/schemas/search';
import type { DefinitionResult } from '@gepard/common/ipc/schemas/lsp';

const SEARCH_PAGE_SIZE = 50;
const SEARCH_GC_MS = 30_000;

function ignoreCancelled<T extends { error: unknown; isError: boolean; failureReason: unknown }>(
  result: T,
): T {
  if (!result.error || !isCancelledError(result.error)) return result;
  return { ...result, error: null, isError: false, failureReason: null };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SearchParams = DistributiveOmit<SearchQuery, 'projectId' | 'sha'>;

function useParamsKey(params: SearchParams | null): unknown {
  return useMemo(
    () => params && { ...params, targetedPaths: digestPaths(params.targetedPaths ?? []) },
    [params],
  );
}

export function useSearch(sha: string, params: SearchParams | null) {
  const projectId = useAppState().projectId ?? '';
  const query = params && projectId && sha ? ({ ...params, projectId, sha } as SearchQuery) : null;
  const paramsKey = useParamsKey(params);
  return ignoreCancelled(
    useQuery({
      queryKey: qk.search(projectId, sha, params?.text ?? '', paramsKey),
      queryFn: () => invoke('search.run', query as SearchQuery),
      enabled: Boolean(query),
      staleTime: Infinity,
      gcTime: SEARCH_GC_MS,
    }),
  );
}

export function useSearchPages(sha: string, params: SearchParams | null) {
  const projectId = useAppState().projectId ?? '';
  const query = params && projectId && sha ? ({ ...params, projectId, sha } as SearchQuery) : null;
  const paramsKey = useParamsKey(params);
  return ignoreCancelled(
    useInfiniteQuery({
      queryKey: qk.searchPages(projectId, sha, params?.text ?? '', paramsKey),
      queryFn: ({ pageParam }) =>
        invoke('search.run', {
          ...(query as SearchQuery),
          offset: pageParam,
          limit: SEARCH_PAGE_SIZE,
        }),
      initialPageParam: 0,
      getNextPageParam: (last) => last.nextOffset ?? undefined,
      enabled: Boolean(query),
      staleTime: Infinity,
      gcTime: SEARCH_GC_MS,
    }),
  );
}

export function useWorkspaceSymbols(query: string, limit?: number) {
  const projectId = useAppState().projectId ?? '';
  const sha = useCurrentHead() ?? '';
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.commit(projectId, sha), 'workspaceSymbols', query, limit] as const,
      queryFn: () => invoke('symbols.workspace', { projectId, sha, query, limit }),
      enabled: Boolean(projectId) && Boolean(sha) && query.length > 0,
    }),
  );
}

export function useLineSymbols(sha: string, path: string, line: number) {
  const projectId = useAppState().projectId ?? '';
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'lineSymbols', line] as const,
      queryFn: () => invoke('symbols.line', { projectId, sha, path, line }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    }),
  );
}

type Pos = { line: number; col: number };

function definitionQuery(projectId: string, sha: string, path: string, pos: Pos | null) {
  return {
    queryKey: [...qk.file(projectId, sha, path), 'definition', pos] as const,
    queryFn: () => invoke('symbols.definition', { projectId, sha, path, pos: pos! }),
  };
}

export function useDefinition(sha: string, path: string, pos: Pos | null) {
  const projectId = useAppState().projectId ?? '';
  return ignoreCancelled(
    useQuery({
      ...definitionQuery(projectId, sha, path, pos),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path) && Boolean(pos),
    }),
  );
}

export function useDefinitionLookup(sha: string, path: string) {
  const projectId = useAppState().projectId ?? '';
  const qc = useQueryClient();
  return useCallback(
    (pos: Pos): Promise<DefinitionResult> => {
      if (!projectId || !sha || !path) return Promise.resolve({ symbol: '', definitions: [] });
      return qc.fetchQuery({ ...definitionQuery(projectId, sha, path, pos), staleTime: Infinity });
    },
    [qc, projectId, sha, path],
  );
}

export function useDocumentSymbols(sha: string, path: string) {
  const projectId = useAppState().projectId ?? '';
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'documentSymbols'] as const,
      queryFn: () => invoke('symbols.document', { projectId, sha, path }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    }),
  );
}
