import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useUiDispatch } from '../../../state/UiContext';
import {
  useCheckoutHead,
  useIsDiffView,
  useLayout,
  useTargetPath,
  useTargeting,
} from '../../../state/hooks';
import { useOpenedProject, useSetLayout } from '../../../queries/projects';
import { useTargetedFiles, useTree } from '../../../queries/files';
import { buildTree, buildFlatList, withRoot, type TreeNode } from '../../../helpers/tree';
import { Message } from '../../../components/Message';
import { Inline } from '../../../components/Layout';
import { Toolbar } from '../../../components/Toolbar';
import { HideViewedToggle } from '../../../components/HideViewedToggle';
import { ViewModeToggle, type ViewMode } from '../../../components/ViewModeToggle';
import { ReviewTree } from '../fileRows/ReviewTree';
import { isViewedRow } from '../../../helpers/row';
import { useRowData } from '../../../queries/review';

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

const Column = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

export function TargetedBrowser(): React.JSX.Element {
  const checkoutHead = useCheckoutHead();
  const layout = useLayout();
  const targeting = useTargeting();
  const dispatch = useUiDispatch();
  const setLayout = useSetLayout();
  const path = useTargetPath();
  const hideViewed = layout.hideViewedFiles;
  const [mode, setMode] = useState<ViewMode>('tree');

  const hasCheckoutTarget = useIsDiffView();
  const { diffMode, changedLoading, rowFor } = useRowData();
  const targetedFiles = useTargetedFiles();
  const fullTree = useTree();
  const rootName = useOpenedProject().data?.project.repo ?? '';

  const visiblePaths = useMemo(
    () => (hideViewed ? targetedFiles.filter((p) => !isViewedRow(rowFor(p))) : targetedFiles),
    [targetedFiles, hideViewed, rowFor],
  );

  const nodes = useMemo<TreeNode<null>[]>(() => {
    if (mode === 'flat') return buildFlatList(visiblePaths);
    const entries = buildTree(visiblePaths);
    return entries.length > 0 ? withRoot(entries, rootName) : entries;
  }, [visiblePaths, mode, rootName]);

  function setHideViewed(hide: boolean): void {
    dispatch({ type: 'layout/setHideViewedFiles', hide });
    setLayout.mutate({ ...layout, hideViewedFiles: hide });
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
  if (hasCheckoutTarget && !checkoutHead)
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
  if (targetedFiles.length === 0) {
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
    <Column>
      <Toolbar>
        <Inline $gap={1}>
          {targeting.pr !== null && (
            <HideViewedToggle value={hideViewed} onChange={setHideViewed} />
          )}
          <ViewModeToggle value={mode} onChange={setMode} />
        </Inline>
      </Toolbar>
      {visiblePaths.length === 0 ? (
        <Message>
          <FormattedMessage {...messages.allViewed} />
        </Message>
      ) : (
        <ReviewTree nodes={nodes} />
      )}
    </Column>
  );
}
