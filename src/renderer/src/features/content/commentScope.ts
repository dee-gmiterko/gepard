import { useMemo } from 'react'
import { useAppState } from '../../state/AppContext'
import { useChangedFiles } from '../../queries/files'

export function useIsCheckedOutChangedFile(path: string | null): boolean {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const checkout = state.checkout
  const { data: changedFiles } = useChangedFiles(
    projectId,
    checkout?.base ?? '',
    checkout?.head ?? ''
  )
  return useMemo(() => {
    if (!checkout || !changedFiles || path === null) return false
    return changedFiles.some((f) => f.path === path || f.previousPath === path)
  }, [checkout, changedFiles, path])
}

export function usePrCommentScope(path: string | null): { enabled: boolean; pr: number | null } {
  const state = useAppState()
  const pr = state.targeting.pr
  const isChangedFile = useIsCheckedOutChangedFile(path)
  const enabled = pr !== null && isChangedFile
  return { enabled, pr: enabled ? pr : null }
}
