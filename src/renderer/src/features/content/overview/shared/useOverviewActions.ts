import { useAppDispatch } from '../../../../state/AppContext';
import { useTargetActions } from '../../../header/useTargetActions';

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
  const dispatch = useAppDispatch();
  const { setPr, setPath, setCommit } = useTargetActions();

  return {
    openPr: (pr) => {
      setPr(pr);
      dispatch({ type: 'mainTab/set', tab: 'overview' });
    },
    reviewPr: (pr) => {
      setPr(pr);
      dispatch({ type: 'mainTab/set', tab: 'files' });
    },
    showAllPrs: () => setPr(null),
    openComments: () => dispatch({ type: 'mainTab/set', tab: 'comments' }),
    openFiles: () => dispatch({ type: 'mainTab/set', tab: 'files' }),
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
