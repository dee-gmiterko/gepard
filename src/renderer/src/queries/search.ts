import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { invoke, isCancelledError } from '../ipc/client'
import { qk } from './keys'
import type { SearchQuery } from '@shared/ipc/schemas/search'

// React Query keeps `data` at its last successful value when a fetch fails.
function ignoreCancelled<TData, TError>(
  result: UseQueryResult<TData, TError>
): UseQueryResult<TData, TError> {
  if (!result.error || !isCancelledError(result.error)) return result
  return {
    ...result,
    error: null,
    isError: false,
    failureReason: null
  } as UseQueryResult<TData, TError>
}

export function useSearch(query: SearchQuery | null) {
  return ignoreCancelled(
    useQuery({
      queryKey: qk.search(query?.projectId ?? '', query?.sha ?? '', query?.text ?? '', query),
      queryFn: () => invoke('search.run', query as SearchQuery),
      enabled: Boolean(query),
      staleTime: Infinity
    })
  )
}

export function useWorkspaceSymbols(projectId: string, sha: string, query: string, limit?: number) {
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.commit(projectId, sha), 'workspaceSymbols', query, limit] as const,
      queryFn: () => invoke('symbols.workspace', { projectId, sha, query, limit }),
      enabled: Boolean(projectId) && Boolean(sha) && query.length > 0
    })
  )
}

export function useLineSymbols(projectId: string, sha: string, path: string, line: number) {
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'lineSymbols', line] as const,
      queryFn: () => invoke('symbols.line', { projectId, sha, path, line }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path)
    })
  )
}

export function useDefinition(
  projectId: string,
  sha: string,
  path: string,
  pos: { line: number; col: number } | null
) {
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'definition', pos] as const,
      queryFn: () => invoke('symbols.definition', { projectId, sha, path, pos: pos! }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path) && Boolean(pos)
    })
  )
}
