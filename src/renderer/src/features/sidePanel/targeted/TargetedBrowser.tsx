// Targeted file browser - limited to targeted files changed (or folder
// targeted), tree or flat list (spec). With a PR or commit checked out, rows
// show +/- counts and a viewed checkbox, and folders show sums and apply
// viewed to everything under them. With only a folder targeted (no
// checkout), it's the full tree limited to that folder — no diff to count
// against, and viewed state only exists for a targeted PR (report 04 §4.3).
// Publishes its display order for Up/Down navigation (keyboard/targetedOrder).
import { useMemo, useState } from 'react'
import { useAppState } from '../../../state/AppContext'
import { isDiffView } from '../../../state/selectors'
import { useTree } from '../../../queries/files'
import { useCurrentHead } from '../../../queries/projects'
import { useRegisterTargetedOrder } from '../../../keyboard/targetedOrder'
import { buildTree, buildFlatList, flattenLeafPaths, type TreeNode } from '../../../components/Tree'
import { Message } from '../../../components/Message'
import { Toolbar } from '../../../components/Toolbar'
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle'
import { isWithin } from '@shared/model/paths'
import { ReviewTree } from '../fileRows/ReviewTree'
import { aggregateRows, useRowData, ZERO_ROW, type RowData } from '../fileRows/rowData'

export function TargetedBrowser(): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const folder = state.targeting.folder
  const [mode, setMode] = useState<ViewMode>('tree')

  const hasCheckoutTarget = isDiffView(state)
  const { diffMode, pr, changedFiles, changedLoading, rowFor } = useRowData()

  const currentHead = useCurrentHead(state.projectId)
  const fullTree = useTree(projectId, currentHead ?? '')

  const items = useMemo(() => {
    if (diffMode) {
      const files = changedFiles ?? []
      const scoped = folder ? files.filter((f) => isWithin(f.path, folder)) : files
      return scoped.map((f) => ({ path: f.path, data: rowFor(f.path) }))
    }
    if (!hasCheckoutTarget && folder) {
      const paths = (fullTree.data ?? []).filter((p) => isWithin(p, folder))
      return paths.map((path) => ({ path, data: ZERO_ROW }))
    }
    return []
  }, [diffMode, hasCheckoutTarget, folder, changedFiles, fullTree.data, rowFor])

  const nodes = useMemo<TreeNode<RowData>[]>(
    () =>
      mode === 'flat' ? buildFlatList(items) : buildTree(items, { aggregateFolder: aggregateRows }),
    [items, mode]
  )

  const order = useMemo(() => flattenLeafPaths(nodes), [nodes])
  useRegisterTargetedOrder(order)

  const isLoading = diffMode
    ? changedLoading
    : !hasCheckoutTarget && folder
      ? fullTree.isLoading
      : false

  if (!projectId) return <Message>No project open.</Message>
  if (!hasCheckoutTarget && !folder)
    return <Message>Target a PR, commit, or folder to see files.</Message>
  if (hasCheckoutTarget && !state.checkout) return <Message>Checking out…</Message>
  if (isLoading) return <Message>Loading…</Message>
  if (items.length === 0) {
    return (
      <Message>
        No {diffMode ? 'changed ' : ''}files{folder ? ' in this folder.' : '.'}
      </Message>
    )
  }

  return (
    <div>
      <Toolbar>
        <ViewModeToggle value={mode} onChange={setMode} />
      </Toolbar>
      <ReviewTree nodes={nodes} pr={pr} />
    </div>
  )
}
