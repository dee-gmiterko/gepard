import { useCallback, useMemo } from 'react';
import {
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invoke, isCancelledError } from '../ipc/client';
import { qk } from './keys';
import { useAppState } from '../state/AppContext';
import { useCurrentHead } from './projects';
import { digestPaths } from '../helpers/pathsDigest';
import type { SearchQuery, WorkspaceSymbol, DefinitionResult } from '@gepard/common';

type SymbolKind = WorkspaceSymbol['kind'];

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
  const query = params && projectId && sha ? { ...params, projectId, sha } : null;
  const paramsKey = useParamsKey(params);
  return ignoreCancelled(
    useQuery({
      queryKey: qk.search(projectId, sha, params?.text ?? '', paramsKey),
      queryFn: query ? () => invoke('search.run', query) : skipToken,
      staleTime: Infinity,
      gcTime: SEARCH_GC_MS,
    }),
  );
}

export function useSearches(sha: string, paramsList: SearchParams[]) {
  const projectId = useAppState().projectId ?? '';
  return useQueries({
    queries: paramsList.map((params) => ({
      queryKey: qk.search(projectId, sha, params.text, {
        ...params,
        targetedPaths: digestPaths(params.targetedPaths ?? []),
      }),
      queryFn: () => invoke('search.run', { ...params, projectId, sha }),
      enabled: Boolean(projectId) && Boolean(sha),
      staleTime: Infinity,
      gcTime: SEARCH_GC_MS,
    })),
  });
}

export function useSearchPages(sha: string, params: SearchParams | null) {
  const projectId = useAppState().projectId ?? '';
  const query = params && projectId && sha ? { ...params, projectId, sha } : null;
  const paramsKey = useParamsKey(params);
  return ignoreCancelled(
    useInfiniteQuery({
      queryKey: qk.searchPages(projectId, sha, params?.text ?? '', paramsKey),
      queryFn: query
        ? ({ pageParam }) =>
            invoke('search.run', { ...query, offset: pageParam, limit: SEARCH_PAGE_SIZE })
        : skipToken,
      initialPageParam: 0,
      getNextPageParam: (last) => last.nextOffset ?? undefined,
      staleTime: Infinity,
      gcTime: SEARCH_GC_MS,
    }),
  );
}

export function useWorkspaceSymbols(query: string, limit?: number, kinds?: SymbolKind[]) {
  const projectId = useAppState().projectId ?? '';
  const sha = useCurrentHead() ?? '';
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.commit(projectId, sha), 'workspaceSymbols', query, limit, kinds] as const,
      queryFn: () => invoke('symbols.workspace', { projectId, sha, query, limit, kinds }),
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

function definitionKey(projectId: string, sha: string, path: string, pos: Pos | null) {
  return [...qk.file(projectId, sha, path), 'definition', pos] as const;
}

function fetchDefinition(projectId: string, sha: string, path: string, pos: Pos) {
  return invoke('symbols.definition', { projectId, sha, path, pos });
}

export function useDefinition(sha: string, path: string, pos: Pos | null) {
  const projectId = useAppState().projectId ?? '';
  return ignoreCancelled(
    useQuery({
      queryKey: definitionKey(projectId, sha, path, pos),
      queryFn: pos ? () => fetchDefinition(projectId, sha, path, pos) : skipToken,
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    }),
  );
}

export function useDefinitions(sha: string, path: string, positions: Pos[]) {
  const projectId = useAppState().projectId ?? '';
  return useQueries({
    queries: positions.map((pos) => ({
      queryKey: definitionKey(projectId, sha, path, pos),
      queryFn: () => fetchDefinition(projectId, sha, path, pos),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path),
    })),
    combine: (results) => ({
      pending: results.some((r) => r.isPending && r.fetchStatus !== 'idle'),
      definitions: results.flatMap((r) => r.data?.definitions ?? []),
    }),
  });
}

export function useDefinitionLookup(sha: string, path: string) {
  const projectId = useAppState().projectId ?? '';
  const qc = useQueryClient();
  return useCallback(
    (pos: Pos): Promise<DefinitionResult> => {
      if (!projectId || !sha || !path) return Promise.resolve({ symbol: '', definitions: [] });
      return qc.fetchQuery({
        queryKey: definitionKey(projectId, sha, path, pos),
        queryFn: () => fetchDefinition(projectId, sha, path, pos),
        staleTime: Infinity,
      });
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
