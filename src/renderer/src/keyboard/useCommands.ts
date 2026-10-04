import { useMemo } from 'react';
import { defineMessages } from 'react-intl';
import { useAppDispatch, useAppState } from '../state/AppContext';
import type { QuickSearchMode, SidePanelTab } from '../state/reducer';
import { useSetLayout } from '../queries/projects';
import { useSetViewed, useViewed } from '../queries/comments';
import { useChangedFiles, useTargetedFiles } from '../queries/files';
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
  setViewedPaths: (paths: string[], viewed: boolean) => void;
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
  const activePath = useAppState().activeFile;
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
  const state = useAppState();
  const dispatch = useAppDispatch();
  const pr = state.targeting.pr;
  const hideViewed = state.layout.hideViewedFiles;

  const { data: viewed } = useViewed();
  const { mutate: setViewed } = useSetViewed();
  const { mutate: setLayout } = useSetLayout();
  const layout = state.layout;
  const { data: changedFiles } = useChangedFiles();
  const activePath = state.activeFile;
  const acceptedFiles = state.acceptedFiles;
  const targetedFiles = useTargetedFiles();

  return useMemo<Commands>(() => {
    const viewedPaths = new Set(viewed?.filter((v) => v.viewed).map((v) => v.path));
    const changedPaths = new Set<string>();
    for (const f of changedFiles ?? []) {
      changedPaths.add(f.path);
      if (f.previousPath) changedPaths.add(f.previousPath);
    }

    function canMarkViewed(path: string | null): path is string {
      return pr !== null && path !== null && changedPaths.has(path);
    }

    function move(direction: 1 | -1, skip: ReadonlySet<string> = viewedPaths): boolean {
      const next = nextTargetedFile(targetedFiles, activePath, skip, direction);
      if (next === null) return false;
      dispatch({ type: 'file/open', path: next });
      return true;
    }

    function setViewedPaths(paths: string[], isViewed: boolean): void {
      setViewed({ paths, viewed: isViewed });
      if (isViewed && hideViewed && activePath !== null && paths.includes(activePath)) {
        move(1, new Set([...viewedPaths, ...paths]));
      }
    }

    return {
      toggleViewed: (path = activePath) => {
        if (!canMarkViewed(path)) return false;
        setViewedPaths([path], !viewedPaths.has(path));
        return true;
      },
      setViewedPaths,
      nextFile: () => move(1),
      prevFile: () => move(-1),
      acceptNext: () => {
        if (activePath === null) return false;
        if (canMarkViewed(activePath)) {
          setViewed({ paths: [activePath], viewed: true });
          dispatch({ type: 'file/accept', path: activePath });
        }
        if (!move(1)) dispatch({ type: 'file/close', path: activePath });
        return true;
      },
      revertPrev: () => {
        const path = acceptedFiles.at(-1);
        if (path === undefined) return false;
        dispatch({ type: 'file/revert' });
        if (pr !== null) setViewed({ paths: [path], viewed: false });
        dispatch({ type: 'file/open', path });
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
        const full = !layout.fullFileDiff;
        dispatch({ type: 'layout/setFullFileDiff', full });
        setLayout({ ...layout, fullFileDiff: full });
        dispatch({
          type: 'headerStatus/publish',
          message: full ? messages.fullFileOn : messages.fullFileOff,
        });
        return true;
      },
    };
  }, [
    activePath,
    acceptedFiles,
    pr,
    hideViewed,
    layout,
    setLayout,
    viewed,
    changedFiles,
    setViewed,
    dispatch,
    targetedFiles,
  ]);
}
