import { useMemo, useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
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

const messages = defineMessages({
  noTarget: {
    id: 'sidePanel.targetedBrowser.noTarget',
    defaultMessage: 'Target a PR, commit, or path to see files.'
  },
  checkingOut: {
    id: 'sidePanel.targetedBrowser.checkingOut',
    defaultMessage: 'Checking out…'
  },
  loading: {
    id: 'sidePanel.targetedBrowser.loading',
    defaultMessage: 'Loading…'
  },
  emptyAll: {
    id: 'sidePanel.targetedBrowser.emptyAll',
    defaultMessage: 'No files.'
  },
  emptyAllForPath: {
    id: 'sidePanel.targetedBrowser.emptyAllForPath',
    defaultMessage: 'No files for this path.'
  },
  emptyChanged: {
    id: 'sidePanel.targetedBrowser.emptyChanged',
    defaultMessage: 'No changed files.'
  },
  emptyChangedForPath: {
    id: 'sidePanel.targetedBrowser.emptyChangedForPath',
    defaultMessage: 'No changed files for this path.'
  }
})

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

  if (!hasCheckoutTarget && !path)
    return (
      <Message>
        <FormattedMessage {...messages.noTarget} />
      </Message>
    )
  if (hasCheckoutTarget && !state.checkout)
    return (
      <Message>
        <FormattedMessage {...messages.checkingOut} />
      </Message>
    )
  if (isLoading)
    return (
      <Message>
        <FormattedMessage {...messages.loading} />
      </Message>
    )
  if (items.length === 0) {
    const emptyMessage = diffMode
      ? path
        ? messages.emptyChangedForPath
        : messages.emptyChanged
      : path
        ? messages.emptyAllForPath
        : messages.emptyAll
    return (
      <Message>
        <FormattedMessage {...emptyMessage} />
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
