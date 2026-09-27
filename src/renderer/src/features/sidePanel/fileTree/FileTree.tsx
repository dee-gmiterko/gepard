import { useMemo } from 'react'
import { useAppState } from '../../../state/AppContext'
import { useCurrentHead } from '../../../queries/projects'
import { useTree } from '../../../queries/files'
import { buildTree } from '../../../components/Tree'
import { Message } from '../../../components/Message'
import { ReviewTree } from '../fileRows/ReviewTree'
import { aggregateRows, useRowData } from '../fileRows/rowData'

export function FileTree(): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const head = useCurrentHead(state.projectId)
  const { data: paths, isLoading } = useTree(projectId, head ?? '')
  const { pr, rowFor } = useRowData()

  const nodes = useMemo(
    () =>
      buildTree(
        (paths ?? []).map((path) => ({ path, data: rowFor(path) })),
        { aggregateFolder: aggregateRows }
      ),
    [paths, rowFor]
  )

  if (!head) return <Message>Opening project…</Message>
  if (isLoading) return <Message>Loading files…</Message>
  if (nodes.length === 0) return <Message>No files.</Message>

  return <ReviewTree nodes={nodes} pr={pr} />
}
