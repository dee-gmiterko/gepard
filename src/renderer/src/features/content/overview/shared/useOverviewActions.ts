import { useAppDispatch, useAppState } from '../../../../state/AppContext';
import { useTargetActions } from '../../../header/useTargetActions';
import { useOpenReview } from './useOpenReview';

export interface OverviewActions {
  openPr: (pr: number) => void;
  reviewPr: (pr: number) => void;
  showAllPrs: () => void;
  openComments: () => void;
  openFiles: () => void;
  openFile: (path: string) => void;
  openFolder: (path: string) => void;
  openCommit: (sha: string) => void;
}

export function useOverviewActions(): OverviewActions {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { setPr, setPath, setCommit } = useTargetActions();
  const openReview = useOpenReview();

  return {
    openPr: (pr) => {
      setPr(pr);
      dispatch({ type: 'mainTab/set', tab: 'overview' });
    },
    reviewPr: (pr) => {
      setPr(pr);
      openReview({ ...state.targeting, pr, commit: null });
    },
    showAllPrs: () => setPr(null),
    openComments: () => dispatch({ type: 'mainTab/set', tab: 'comments' }),
    openFiles: () => openReview(state.targeting),
    openFile: (path) => dispatch({ type: 'file/open', path }),
    openFolder: (path) => {
      setPath(path);
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
    openCommit: (sha) => {
      setCommit(sha);
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
  };
}
