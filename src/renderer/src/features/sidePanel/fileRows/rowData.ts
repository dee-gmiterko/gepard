import { useCallback, useMemo } from 'react'
import { useAppState } from '../../../state/AppContext'
import { isDiffView } from '../../../state/selectors'
import { useChangedFiles } from '../../../queries/files'
import { useViewed } from '../../../queries/comments'
import type { ChangedFile } from '@shared/ipc/schemas/pr'

export interface RowData {
  additions: number
  deletions: number
  viewedCount: number
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

interface RowDataSource {
  diffMode: boolean
  changedFiles: ChangedFile[] | undefined
  changedLoading: boolean
  rowFor: (path: string) => RowData
}

export function useRowData(): RowDataSource {
  const state = useAppState()
  const diffMode = isDiffView(state) && state.checkout !== null
  const changed = useChangedFiles()
  const { data: viewedList } = useViewed()

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
    changedFiles: diffMode ? changed.data : undefined,
    changedLoading: diffMode && changed.isLoading,
    rowFor
  }
}
