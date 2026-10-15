import { useMemo } from 'react';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import { useUiDispatch, useUiStore } from '../state/UiContext';
import { useActiveFile, useLayout } from '../state/hooks';
import type { Layout, QuickSearchMode, SidePanelTab, UiAction } from '../state/reducer';
import { useSetLayout } from '../queries/projects';
import { useViewed } from '../queries/comments';
import { useTargetedFiles } from '../queries/files';
import { useReviewActions } from '../queries/review';
import { nextReviewFile } from '../helpers/targetedFiles';
import { useRunActionHandler } from './actionHandlers';

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
  incrementalOn: {
    id: 'keyboard.incrementalDiffOn',
    defaultMessage: 'Show incremental: on',
  },
  incrementalOff: {
    id: 'keyboard.incrementalDiffOff',
    defaultMessage: 'Show incremental: off',
  },
});

type BooleanLayoutKey = {
  [K in keyof Layout]: Layout[K] extends boolean ? K : never;
}[keyof Layout];

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
  toggleIncrementalDiff: () => boolean;
  submitComment: () => boolean;
  findNext: () => boolean;
  findPrevious: () => boolean;
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
  const runActionHandler = useRunActionHandler();

  return useMemo<Commands>(() => {
    const toggleLayout = (
      key: BooleanLayoutKey,
      action: (value: boolean) => UiAction,
      status: { on: MessageDescriptor; off: MessageDescriptor },
    ): boolean => {
      const { layout } = store.getState();
      const value = !layout[key];
      dispatch(action(value));
      setLayout({ ...layout, [key]: value });
      dispatch({ type: 'headerStatus/publish', message: value ? status.on : status.off });
      return true;
    };
    return {
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
      toggleWrapLines: () =>
        toggleLayout('wrapLongLines', (wrap) => ({ type: 'layout/setWrapLongLines', wrap }), {
          on: messages.wrapOn,
          off: messages.wrapOff,
        }),
      toggleFullFileDiff: () =>
        toggleLayout('fullFileDiff', (full) => ({ type: 'layout/setFullFileDiff', full }), {
          on: messages.fullFileOn,
          off: messages.fullFileOff,
        }),
      toggleRandomizeOrder: () =>
        toggleLayout(
          'randomizeOrder',
          (randomize) => ({ type: 'layout/setRandomizeOrder', randomize }),
          { on: messages.randomizeOn, off: messages.randomizeOff },
        ),
      toggleIncrementalDiff: () =>
        toggleLayout(
          'incrementalDiff',
          (incremental) => ({ type: 'layout/setIncrementalDiff', incremental }),
          { on: messages.incrementalOn, off: messages.incrementalOff },
        ),
      submitComment: () => runActionHandler('submitComment'),
      findNext: () => runActionHandler('findNext'),
      findPrevious: () => runActionHandler('findPrevious'),
    };
  }, [store, dispatch, setLayout, review, runActionHandler]);
}
