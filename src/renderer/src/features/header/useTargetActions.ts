import { useAppDispatch } from '../../state/AppContext';
import { useTargeting } from '../../state/hooks';
import { useSetTargeting } from '../../queries/projects';
import type { AppAction, Targeting } from '../../state/reducer';

export interface TargetActions {
  setPr: (pr: number | null) => void;
  setCommit: (sha: string | null) => void;
  setPath: (path: string | null) => void;
}

export function useTargetActions(): TargetActions {
  const targeting = useTargeting();
  const dispatch = useAppDispatch();
  const setTargeting = useSetTargeting();

  function apply(action: AppAction, targeting: Targeting): void {
    dispatch(action);
    setTargeting.mutate(targeting);
  }

  return {
    setPr: (pr) =>
      apply(
        { type: 'target/pr', pr },
        pr === targeting.pr ? targeting : { pr, commit: null, path: targeting.path },
      ),
    setCommit: (sha) => apply({ type: 'target/commit', sha }, { ...targeting, commit: sha }),
    setPath: (path) => apply({ type: 'target/path', path }, { ...targeting, path }),
  };
}
