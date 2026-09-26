import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { invoke, isCancelledError } from '../ipc/client'
import { qk } from './keys'
import type { SearchQuery } from '@shared/ipc/schemas/search'

/** `search.run`/`symbols.*` requests are latest-wins per project on the main
 * side (coordinator cancellation spec): the search box fires `search.run`/
 * `symbols.workspace` per keystroke and the comment editor fires symbol
 * lookups per anchor, so a superseded in-flight request resolves to a
 * `CANCELLED` error. That is not a real failure — the newer request already
 * carries the answer that matters — so it must not surface as an error state
 * here; React Query already leaves `data` at its last successful value on a
 * failed fetch, so nulling out `error` is enough to "keep the previous data
 * and not surface an error". */
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

/** Every grouped search (side panel, comment-editor "Also in" / "Same
 * pattern in", symbol references) goes through search.run. The whole query
 * is part of the key, so scope/targetedPaths/flags changes refetch. */
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
