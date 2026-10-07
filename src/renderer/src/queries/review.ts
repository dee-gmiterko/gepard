import { useCallback, useMemo } from 'react';
import type { ChangedFile } from '@gepard/common';
import { useCheckoutHead, useIsDiffView } from '../state/hooks';
import { aggregateRows, rowsByPath, ZERO_ROW, type RowData } from '../helpers/row';
import { canMarkViewed, type ReviewFiles } from '../helpers/review';
import { useAppDispatch, useUiStore } from '../state/AppContext';
import { useChangedFiles, useTargetedFiles } from './files';
import { useSetViewed, useViewed } from './comments';

interface RowDataSource {
  diffMode: boolean;
  changedFiles: ChangedFile[] | undefined;
  changedLoading: boolean;
  rows: ReadonlyMap<string, RowData>;
  rowFor: (path: string) => RowData;
}

const EMPTY_ROWS: ReadonlyMap<string, RowData> = new Map();

export function useRowData(): RowDataSource {
  const checkoutHead = useCheckoutHead();
  const isDiff = useIsDiffView();
  const diffMode = isDiff && checkoutHead !== null;
  const changed = useChangedFiles();
  const { data: viewedList } = useViewed();

  const rows = useMemo(
    () => (diffMode ? rowsByPath(changed.data ?? [], viewedList ?? []) : EMPTY_ROWS),
    [diffMode, changed.data, viewedList],
  );

  const rowFor = useCallback((path: string): RowData => rows.get(path) ?? ZERO_ROW, [rows]);

  return {
    diffMode,
    changedFiles: diffMode ? changed.data : undefined,
    changedLoading: diffMode && changed.isLoading,
    rows,
    rowFor,
  };
}

export function useReviewProgress(): RowData {
  const { changedFiles, rowFor } = useRowData();
  return useMemo(
    () => aggregateRows((changedFiles ?? []).map((f) => rowFor(f.path))),
    [changedFiles, rowFor],
  );
}

export function useIsCheckedOutChangedFile(path: string | null): boolean {
  const checkoutHead = useCheckoutHead();
  const { data: changedFiles } = useChangedFiles();
  return useMemo(() => {
    if (!checkoutHead || !changedFiles || path === null) return false;
    return changedFiles.some((f) => f.path === path || f.previousPath === path);
  }, [checkoutHead, changedFiles, path]);
}

function useReviewFiles(): ReviewFiles {
  const { data: viewed } = useViewed();
  const { data: changedFiles } = useChangedFiles();
  const targeted = useTargetedFiles();
  return useMemo(() => {
    const changed = new Set<string>();
    for (const f of changedFiles ?? []) {
      changed.add(f.path);
      if (f.previousPath) changed.add(f.previousPath);
    }
    return {
      targeted,
      changed: [...changed],
      viewed: (viewed ?? []).filter((v) => v.viewed).map((v) => v.path),
    };
  }, [viewed, changedFiles, targeted]);
}

export interface ReviewActions {
  markViewed: (paths: string[], viewed: boolean) => void;
  toggleViewed: (path: string | null) => boolean;
  step: (direction: 1 | -1) => boolean;
  acceptNext: () => boolean;
  revertPrev: () => boolean;
}

export function useReviewActions(): ReviewActions {
  const store = useUiStore();
  const dispatch = useAppDispatch();
  const review = useReviewFiles();
  const { mutate: setViewed } = useSetViewed();

  return useMemo<ReviewActions>(() => {
    const markViewed = (paths: string[], viewed: boolean): void => {
      if (store.getState().targeting.pr === null) return;
      dispatch({ type: 'viewed/mark', paths, viewed, review });
      setViewed({ paths, viewed });
    };
    return {
      markViewed,
      toggleViewed: (path) => {
        if (!canMarkViewed(store.getState().targeting.pr, review, path)) return false;
        markViewed([path], !review.viewed.includes(path));
        return true;
      },
      step: (direction) => {
        const before = store.getState();
        dispatch({ type: 'file/step', direction, review });
        return store.getState() !== before;
      },
      acceptNext: () => {
        const { activeFile, targeting } = store.getState();
        if (activeFile === null) return false;
        if (canMarkViewed(targeting.pr, review, activeFile)) {
          setViewed({ paths: [activeFile], viewed: true });
        }
        dispatch({ type: 'review/acceptNext', review });
        return true;
      },
      revertPrev: () => {
        const { acceptedFiles, targeting } = store.getState();
        const path = acceptedFiles.at(-1);
        if (path === undefined) return false;
        dispatch({ type: 'review/revertPrev' });
        if (targeting.pr !== null) setViewed({ paths: [path], viewed: false });
        return true;
      },
    };
  }, [store, dispatch, review, setViewed]);
}
