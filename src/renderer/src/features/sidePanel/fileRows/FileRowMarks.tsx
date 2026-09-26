// The marks of the spec's "File in sidebar" row: +/- counts and the viewed
// checkbox (only while a PR is targeted). Folder rows pass the changed files
// under them, so their checkbox applies to all of those (spec: "view is
// applied to all under"). Shared by every file list: file browser, targeted
// browser and search results ("standard file row").
import styled from 'styled-components'
import { useAppState } from '../../../state/AppContext'
import { useSetViewed } from '../../../queries/comments'
import { Checkbox } from '../../../components/Checkbox'
import type { RowData } from './rowData'

const Marks = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  flex-shrink: 0;
`

const Counts = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-family: ${({ theme }) => theme.font.mono};
`

const Add = styled.span`
  color: ${({ theme }) => theme.colors.diffAddFg};
`

const Del = styled.span`
  color: ${({ theme }) => theme.colors.diffDelFg};
`

export function FileRowMarks({
  data,
  paths,
  pr
}: {
  data: RowData
  /** Changed files the viewed checkbox applies to. */
  paths: string[]
  pr: number | null
}): React.JSX.Element | null {
  const state = useAppState()
  const { mutate: setViewed } = useSetViewed(state.projectId ?? '', pr ?? NaN)
  const hasCounts = data.additions > 0 || data.deletions > 0
  const hasViewed = pr !== null && data.totalCount > 0
  if (!hasCounts && !hasViewed) return null

  return (
    <Marks>
      {hasCounts && (
        <Counts>
          {data.additions > 0 && <Add>+{data.additions}</Add>}
          {data.deletions > 0 && <Del>-{data.deletions}</Del>}
        </Counts>
      )}
      {hasViewed && (
        <Checkbox
          checked={data.viewedCount === data.totalCount}
          indeterminate={data.viewedCount > 0 && data.viewedCount < data.totalCount}
          onChange={(checked) => setViewed({ paths, viewed: checked })}
        />
      )}
    </Marks>
  )
}
