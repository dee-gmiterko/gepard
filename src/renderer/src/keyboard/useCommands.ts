import { useMemo } from 'react';
import { defineMessages } from 'react-intl';
import { useUiDispatch, useUiStore } from '../state/UiContext';
import { useActiveFile, useLayout } from '../state/hooks';
import type { QuickSearchMode, SidePanelTab } from '../state/reducer';
import { useSetLayout } from '../queries/projects';
import { useViewed } from '../queries/comments';
import { useTargetedFiles } from '../queries/files';
import { useReviewActions } from '../queries/review';
import { nextReviewFile } from '../helpers/targetedFiles';

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
  randomizeOn: {
    id: 'keyboard.randomizeOrderOn',
    defaultMessage: 'Randomize order: on',
  },
  randomizeOff: {
    id: 'keyboard.randomizeOrderOff',
    defaultMessage: 'Randomize order: off',
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
  toggleRandomizeOrder: () => boolean;
}

export function useFileNavigation(): { canGoPrev: boolean; canGoNext: boolean } {
  const activePath = useActiveFile();
  const { data: viewed } = useViewed();
  const targetedFiles = useTargetedFiles();
  const { randomizeOrder } = useLayout();
  return useMemo(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path));
    const next = (direction: 1 | -1): string | null =>
      nextReviewFile(targetedFiles, activePath, viewedPaths, direction, randomizeOrder);
    return { canGoPrev: next(-1) !== null, canGoNext: next(1) !== null };
  }, [viewed, targetedFiles, activePath, randomizeOrder]);
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
      toggleRandomizeOrder: () => {
        const { layout } = store.getState();
        const randomize = !layout.randomizeOrder;
        dispatch({ type: 'layout/setRandomizeOrder', randomize });
        setLayout({ ...layout, randomizeOrder: randomize });
        dispatch({
          type: 'headerStatus/publish',
          message: randomize ? messages.randomizeOn : messages.randomizeOff,
        });
        return true;
      },
    }),
    [store, dispatch, setLayout, review],
  );
}
