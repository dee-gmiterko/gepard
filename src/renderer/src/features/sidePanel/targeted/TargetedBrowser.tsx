import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useAppState } from '../../../state/AppContext';
import { isDiffView } from '../../../state/selectors';
import { useTargetedFiles, useTree } from '../../../queries/files';
import { buildTree, buildFlatList, type TreeNode } from '../../../components/Tree';
import { Message } from '../../../components/Message';
import { Toolbar } from '../../../components/Toolbar';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { ReviewTree } from '../fileRows/ReviewTree';
import { aggregateRows, useRowData, type RowData } from '../fileRows/rowData';

const messages = defineMessages({
  noTarget: {
    id: 'sidePanel.targetedBrowser.noTarget',
    defaultMessage: 'Target a PR, commit, or path to see files.',
  },
  checkingOut: {
    id: 'sidePanel.targetedBrowser.checkingOut',
    defaultMessage: 'Checking out…',
  },
  loading: {
    id: 'sidePanel.targetedBrowser.loading',
    defaultMessage: 'Loading…',
  },
  emptyAll: {
    id: 'sidePanel.targetedBrowser.emptyAll',
    defaultMessage: 'No files.',
  },
  emptyAllForPath: {
    id: 'sidePanel.targetedBrowser.emptyAllForPath',
    defaultMessage: 'No files for this path.',
  },
  emptyChanged: {
    id: 'sidePanel.targetedBrowser.emptyChanged',
    defaultMessage: 'No changed files.',
  },
  emptyChangedForPath: {
    id: 'sidePanel.targetedBrowser.emptyChangedForPath',
    defaultMessage: 'No changed files for this path.',
  },
});

export function TargetedBrowser(): React.JSX.Element {
  const state = useAppState();
  const path = state.targeting.path;
  const [mode, setMode] = useState<ViewMode>('tree');

  const hasCheckoutTarget = isDiffView(state);
  const { diffMode, changedLoading, rowFor } = useRowData();
  const targetedFiles = useTargetedFiles();
  const fullTree = useTree();

  const items = useMemo(
    () => targetedFiles.map((p) => ({ path: p, data: rowFor(p) })),
    [targetedFiles, rowFor],
  );

  const nodes = useMemo<TreeNode<RowData>[]>(
    () =>
      mode === 'flat' ? buildFlatList(items) : buildTree(items, { aggregateFolder: aggregateRows }),
    [items, mode],
  );

  const isLoading = diffMode
    ? changedLoading
    : !hasCheckoutTarget && path
      ? fullTree.isLoading
      : false;

  if (!hasCheckoutTarget && !path)
    return (
      <Message>
        <FormattedMessage {...messages.noTarget} />
      </Message>
    );
  if (hasCheckoutTarget && !state.checkout)
    return (
      <Message>
        <FormattedMessage {...messages.checkingOut} />
      </Message>
    );
  if (isLoading)
    return (
      <Message>
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  if (items.length === 0) {
    const emptyMessage = diffMode
      ? path
        ? messages.emptyChangedForPath
        : messages.emptyChanged
      : path
        ? messages.emptyAllForPath
        : messages.emptyAll;
    return (
      <Message>
        <FormattedMessage {...emptyMessage} />
      </Message>
    );
  }

  return (
    <div>
      <Toolbar>
        <ViewModeToggle value={mode} onChange={setMode} />
      </Toolbar>
      <ReviewTree nodes={nodes} />
    </div>
  );
}
