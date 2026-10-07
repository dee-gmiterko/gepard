import { useMemo } from 'react';
import { defineMessages } from 'react-intl';
import { useUiDispatch, useUiStore } from '../state/UiContext';
import { useActiveFile } from '../state/hooks';
import type { QuickSearchMode, SidePanelTab } from '../state/reducer';
import { useSetLayout } from '../queries/projects';
import { useViewed } from '../queries/comments';
import { useTargetedFiles } from '../queries/files';
import { useReviewActions } from '../queries/review';
import { nextTargetedFile } from '../helpers/targetedFiles';

const messages = defineMessages({
  wrapOn: {
    id: 'keyboard.wrapLongLinesOn',
    defaultMessage: 'Wrap long lines: on',
  },
  wrapOff: {
    id: 'keyboard.wrapLongLinesOff',
    defaultMessage: 'Wrap long lines: off',
  },
  fullFileOn: {
    id: 'keyboard.fullFileDiffOn',
    defaultMessage: 'Full file: on',
  },
  fullFileOff: {
    id: 'keyboard.fullFileDiffOff',
    defaultMessage: 'Full file: off',
  },
});

export interface Commands {
  toggleViewed: (path?: string | null) => boolean;
  markViewed: (paths: string[], viewed: boolean) => void;
  nextFile: () => boolean;
  prevFile: () => boolean;
  acceptNext: () => boolean;
  revertPrev: () => boolean;
  showSidePanelTab: (tab: SidePanelTab) => boolean;
  openQuickSearch: (mode: QuickSearchMode) => boolean;
  toggleWrapLines: () => boolean;
  toggleFullFileDiff: () => boolean;
}

export function useFileNavigation(): { canGoPrev: boolean; canGoNext: boolean } {
  const activePath = useActiveFile();
  const { data: viewed } = useViewed();
  const targetedFiles = useTargetedFiles();
  return useMemo(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path));
    return {
      canGoPrev: nextTargetedFile(targetedFiles, activePath, viewedPaths, -1) !== null,
      canGoNext: nextTargetedFile(targetedFiles, activePath, viewedPaths, 1) !== null,
    };
  }, [viewed, targetedFiles, activePath]);
}

export function useCommands(): Commands {
  const store = useUiStore();
  const dispatch = useUiDispatch();
  const { mutate: setLayout } = useSetLayout();
  const review = useReviewActions();

  return useMemo<Commands>(
    () => ({
      toggleViewed: (path = store.getState().activeFile) => review.toggleViewed(path),
      markViewed: review.markViewed,
      nextFile: () => review.step(1),
      prevFile: () => review.step(-1),
      acceptNext: () => review.acceptNext(),
      revertPrev: () => review.revertPrev(),
      showSidePanelTab: (tab) => {
        dispatch({ type: 'sidePanel/setTab', tab, focus: true });
        return true;
      },
      openQuickSearch: (mode) => {
        dispatch({ type: 'quickSearch/open', mode });
        return true;
      },
      toggleWrapLines: () => {
        const { layout } = store.getState();
        const wrap = !layout.wrapLongLines;
        dispatch({ type: 'layout/setWrapLongLines', wrap });
        setLayout({ ...layout, wrapLongLines: wrap });
        dispatch({
          type: 'headerStatus/publish',
          message: wrap ? messages.wrapOn : messages.wrapOff,
        });
        return true;
      },
      toggleFullFileDiff: () => {
        const { layout } = store.getState();
        const full = !layout.fullFileDiff;
        dispatch({ type: 'layout/setFullFileDiff', full });
        setLayout({ ...layout, fullFileDiff: full });
        dispatch({
          type: 'headerStatus/publish',
          message: full ? messages.fullFileOn : messages.fullFileOff,
        });
        return true;
      },
    }),
    [store, dispatch, setLayout, review],
  );
}
