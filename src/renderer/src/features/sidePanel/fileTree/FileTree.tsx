// File browser - full tree (spec) from `trees.get` at the current head
// (checked-out target's head, else the project's initial open head). With a
// PR/commit checked out, changed files show their +/- counts and viewed
// checkbox here too, and folders their sums (spec "File in sidebar").
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
  // A failed `projects.open` or `trees.get` reaches the unified toast surface
  // via the global query cache (main.tsx); with no head/paths this panel just
  // stays in its "opening/loading" state rather than duplicating that error.
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
