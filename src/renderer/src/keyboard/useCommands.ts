import { useMemo } from 'react';
import { defineMessages } from 'react-intl';
import { useAppDispatch, useAppStore } from '../state/AppContext';
import { useActiveFile } from '../state/hooks';
import { canMarkViewed, type QuickSearchMode, type SidePanelTab } from '../state/reducer';
import { useSetLayout } from '../queries/projects';
import { useViewed } from '../queries/comments';
import { useTargetedFiles } from '../queries/files';
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
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const { mutate: setLayout } = useSetLayout();

  return useMemo<Commands>(
    () => ({
      toggleViewed: (path = store.getState().activeFile) => {
        if (!canMarkViewed(store.getState(), path)) return false;
        dispatch({ type: 'viewed/toggle', path });
        return true;
      },
      nextFile: () => {
        const before = store.getState();
        dispatch({ type: 'file/step', direction: 1 });
        return store.getState() !== before;
      },
      prevFile: () => {
        const before = store.getState();
        dispatch({ type: 'file/step', direction: -1 });
        return store.getState() !== before;
      },
      acceptNext: () => {
        if (store.getState().activeFile === null) return false;
        dispatch({ type: 'review/acceptNext' });
        return true;
      },
      revertPrev: () => {
        if (store.getState().acceptedFiles.length === 0) return false;
        dispatch({ type: 'review/revertPrev' });
        return true;
      },
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
    [store, dispatch, setLayout],
  );
}
