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
import { matchesTarget } from '@shared/model/paths'
import { ReviewTree } from '../fileRows/ReviewTree'
import { aggregateRows, useRowData, ZERO_ROW, type RowData } from '../fileRows/rowData'

export function TargetedBrowser(): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const path = state.targeting.path
  const [mode, setMode] = useState<ViewMode>('tree')

  const hasCheckoutTarget = isDiffView(state)
  const { diffMode, pr, changedFiles, changedLoading, rowFor } = useRowData()

  const currentHead = useCurrentHead(state.projectId)
  const fullTree = useTree(projectId, currentHead ?? '')

  const items = useMemo(() => {
    if (diffMode) {
      const files = changedFiles ?? []
      const scoped = path ? files.filter((f) => matchesTarget(f.path, path)) : files
      return scoped.map((f) => ({ path: f.path, data: rowFor(f.path) }))
    }
    if (!hasCheckoutTarget && path) {
      const paths = (fullTree.data ?? []).filter((p) => matchesTarget(p, path))
      return paths.map((p) => ({ path: p, data: ZERO_ROW }))
    }
    return []
  }, [diffMode, hasCheckoutTarget, path, changedFiles, fullTree.data, rowFor])

  const nodes = useMemo<TreeNode<RowData>[]>(
    () =>
      mode === 'flat' ? buildFlatList(items) : buildTree(items, { aggregateFolder: aggregateRows }),
    [items, mode]
  )

  const order = useMemo(() => flattenLeafPaths(nodes), [nodes])
  useRegisterTargetedOrder(order)

  const isLoading = diffMode
    ? changedLoading
    : !hasCheckoutTarget && path
      ? fullTree.isLoading
      : false

  if (!projectId) return <Message>No project open.</Message>
  if (!hasCheckoutTarget && !path)
    return <Message>Target a PR, commit, or path to see files.</Message>
  if (hasCheckoutTarget && !state.checkout) return <Message>Checking out…</Message>
  if (isLoading) return <Message>Loading…</Message>
  if (items.length === 0) {
    return (
      <Message>
        No {diffMode ? 'changed ' : ''}files{path ? ' for this path.' : '.'}
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
