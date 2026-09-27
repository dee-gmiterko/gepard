import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { invoke, isCancelledError } from '../ipc/client'
import { qk } from './keys'
import { useAppState } from '../state/AppContext'
import { useCurrentHead } from './projects'
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type SearchParams = DistributiveOmit<SearchQuery, 'projectId' | 'sha'>

export function useSearch(sha: string, params: SearchParams | null) {
  const projectId = useAppState().projectId ?? ''
  const query = params && projectId && sha ? ({ ...params, projectId, sha } as SearchQuery) : null
  return ignoreCancelled(
    useQuery({
      queryKey: qk.search(projectId, sha, params?.text ?? '', params),
      queryFn: () => invoke('search.run', query as SearchQuery),
      enabled: Boolean(query),
      staleTime: Infinity
    })
  )
}

export function useWorkspaceSymbols(query: string, limit?: number) {
  const projectId = useAppState().projectId ?? ''
  const sha = useCurrentHead() ?? ''
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.commit(projectId, sha), 'workspaceSymbols', query, limit] as const,
      queryFn: () => invoke('symbols.workspace', { projectId, sha, query, limit }),
      enabled: Boolean(projectId) && Boolean(sha) && query.length > 0
    })
  )
}

export function useLineSymbols(sha: string, path: string, line: number) {
  const projectId = useAppState().projectId ?? ''
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'lineSymbols', line] as const,
      queryFn: () => invoke('symbols.line', { projectId, sha, path, line }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path)
    })
  )
}

export function useDefinition(
  sha: string,
  path: string,
  pos: { line: number; col: number } | null
) {
  const projectId = useAppState().projectId ?? ''
  return ignoreCancelled(
    useQuery({
      queryKey: [...qk.file(projectId, sha, path), 'definition', pos] as const,
      queryFn: () => invoke('symbols.definition', { projectId, sha, path, pos: pos! }),
      enabled: Boolean(projectId) && Boolean(sha) && Boolean(path) && Boolean(pos)
    })
  )
}
