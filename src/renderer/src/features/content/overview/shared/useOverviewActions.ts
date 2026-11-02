import { useUiDispatch } from '../../../../state/UiContext';
import { useOverviewPr, useTargeting } from '../../../../state/hooks';
import { useTargetActions } from '../../../header/useTargetActions';
import type { Targeting } from '../../../../state/reducer';
import { useOpenReview } from './useOpenReview';

export interface OverviewActions {
  openPr: (pr: number) => void;
  reviewPr: (pr: number) => void;
  showAllPrs: () => void;
  openComments: () => void;
  openFiles: () => void;
  openFile: (path: string) => void;
  openFolder: (path: string) => void;
  openExtension: (extension: string) => void;
  openCommit: (sha: string) => void;
}

export function useOverviewActions(): OverviewActions {
  const targeting = useTargeting();
  const overviewPr = useOverviewPr();
  const dispatch = useUiDispatch();
  const { setTarget } = useTargetActions();
  const openReview = useOpenReview();

  function reviewPr(pr: number | null): void {
    const next = { pr, commit: null, path: targeting.path };
    setTarget(next);
    openReview(next);
  }

  function focusOverviewPr(patch: Partial<Targeting> = {}): void {
    const pr = overviewPr ?? targeting.pr;
    setTarget({
      pr,
      commit: pr === targeting.pr ? targeting.commit : null,
      path: targeting.path,
      ...patch,
    });
  }

  return {
    openPr: (pr) => {
      dispatch({ type: 'overview/pr', pr });
      dispatch({ type: 'mainTab/set', tab: 'overview' });
    },
    reviewPr,
    showAllPrs: () => dispatch({ type: 'overview/pr', pr: null }),
    openComments: () => {
      focusOverviewPr();
      dispatch({ type: 'mainTab/set', tab: 'comments' });
    },
    openFiles: () => reviewPr(overviewPr ?? targeting.pr),
    openFile: (path) => {
      focusOverviewPr();
      dispatch({ type: 'file/open', path });
    },
    openFolder: (path) => {
      focusOverviewPr({ path });
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
    openExtension: (extension) => {
      focusOverviewPr({ path: `**/*${extension}` });
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
    openCommit: (sha) => {
      focusOverviewPr({ commit: sha });
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
  };
}
