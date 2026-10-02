import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { isDiffView } from '../../../state/selectors';
import { useOpenProject, useSetLayout } from '../../../queries/projects';
import { useTargetedFiles, useTree } from '../../../queries/files';
import { buildTree, buildFlatList, withRoot, type TreeNode } from '../../../helpers/tree';
import { Message } from '../../../components/Message';
import { Inline } from '../../../components/Layout';
import { Toolbar } from '../../../components/Toolbar';
import { HideViewedToggle } from '../../../components/HideViewedToggle';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { ReviewTree } from '../fileRows/ReviewTree';
import { aggregateRows, hideViewedRows, type RowData } from '../../../helpers/row';
import { useRowData } from '../fileRows/rowData';

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
  allViewed: {
    id: 'sidePanel.targetedBrowser.allViewed',
    defaultMessage: 'All files viewed.',
  },
});

export function TargetedBrowser(): React.JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const setLayout = useSetLayout();
  const path = state.targeting.path;
  const hideViewed = state.layout.hideViewedFiles;
  const [mode, setMode] = useState<ViewMode>('tree');

  const hasCheckoutTarget = isDiffView(state);
  const { diffMode, changedLoading, rowFor } = useRowData();
  const targetedFiles = useTargetedFiles();
  const fullTree = useTree();
  const rootName = useOpenProject().data?.project.repo ?? '';

  const items = useMemo(
    () => targetedFiles.map((p) => ({ path: p, data: rowFor(p) })),
    [targetedFiles, rowFor],
  );

  const visibleItems = useMemo(() => hideViewedRows(items, hideViewed), [items, hideViewed]);

  const nodes = useMemo<TreeNode<RowData>[]>(() => {
    if (mode === 'flat') return buildFlatList(visibleItems);
    const options = { aggregateFolder: aggregateRows };
    const entries = buildTree(visibleItems, options);
    return entries.length > 0 ? withRoot(entries, rootName, options) : entries;
  }, [visibleItems, mode, rootName]);

  function setHideViewed(hide: boolean): void {
    dispatch({ type: 'layout/setHideViewedFiles', hide });
    setLayout.mutate({ ...state.layout, hideViewedFiles: hide });
  }

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
        <Inline $gap={1}>
          {state.targeting.pr !== null && (
            <HideViewedToggle value={hideViewed} onChange={setHideViewed} />
          )}
          <ViewModeToggle value={mode} onChange={setMode} />
        </Inline>
      </Toolbar>
      {visibleItems.length === 0 ? (
        <Message>
          <FormattedMessage {...messages.allViewed} />
        </Message>
      ) : (
        <ReviewTree nodes={nodes} />
      )}
    </div>
  );
}
