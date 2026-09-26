// Data behind the spec's "File in sidebar" row, shared by the file browser
// and the targeted browser: +/- counts of the checked-out PR/commit diff and
// the viewed state (only while a PR is targeted, report 04 §4.3); folders
// sum their children and a folder's viewed checkbox applies to every changed
// file under it that the tab shows (spec Components).
import { useCallback, useMemo } from 'react'
import { useAppState } from '../../../state/AppContext'
import { isDiffView } from '../../../state/selectors'
import { useChangedFiles } from '../../../queries/files'
import { useViewed } from '../../../queries/comments'
import type { ChangedFile } from '@shared/ipc/schemas/pr'

export interface RowData {
  additions: number
  deletions: number
  /** Changed files (under a folder) that are marked viewed. */
  viewedCount: number
  /** Changed files (under a folder); 0 = nothing to review here. */
  totalCount: number
}

export const ZERO_ROW: RowData = { additions: 0, deletions: 0, viewedCount: 0, totalCount: 0 }

export function aggregateRows(children: RowData[]): RowData {
  return children.reduce(
    (sum, c) => ({
      additions: sum.additions + c.additions,
      deletions: sum.deletions + c.deletions,
      viewedCount: sum.viewedCount + c.viewedCount,
      totalCount: sum.totalCount + c.totalCount
    }),
    ZERO_ROW
  )
}

export interface RowDataSource {
  /** A PR/commit is checked out: rows carry diff counts. */
  diffMode: boolean
  pr: number | null
  changedFiles: ChangedFile[] | undefined
  changedLoading: boolean
  rowFor: (path: string) => RowData
}

export function useRowData(): RowDataSource {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  // A PR or commit target diffs against a checkout; folder-only targeting
  // has nothing to count against.
  const diffMode = isDiffView(state) && state.checkout !== null
  const changed = useChangedFiles(projectId, state.checkout?.base ?? '', state.checkout?.head ?? '')
  const { data: viewedList } = useViewed(projectId, pr ?? NaN)

  const byPath = useMemo(() => {
    const viewed = new Set((viewedList ?? []).filter((v) => v.viewed).map((v) => v.path))
    const map = new Map<string, RowData>()
    if (!diffMode) return map
    for (const f of changed.data ?? []) {
      map.set(f.path, {
        additions: f.additions,
        deletions: f.deletions,
        viewedCount: viewed.has(f.path) ? 1 : 0,
        totalCount: 1
      })
    }
    return map
  }, [diffMode, changed.data, viewedList])

  const rowFor = useCallback((path: string): RowData => byPath.get(path) ?? ZERO_ROW, [byPath])

  return {
    diffMode,
    pr,
    changedFiles: diffMode ? changed.data : undefined,
    changedLoading: diffMode && changed.isLoading,
    rowFor
  }
}
