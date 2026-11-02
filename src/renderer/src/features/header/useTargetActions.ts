import { useUiDispatch } from '../../state/UiContext';
import { useTargeting } from '../../state/hooks';
import { useSetTargeting } from '../../queries/projects';
import type { UiAction, Targeting } from '../../state/reducer';

export interface TargetActions {
  setPr: (pr: number | null) => void;
  setCommit: (sha: string | null) => void;
  setPath: (path: string | null) => void;
  setTarget: (next: Targeting) => void;
}

export function useTargetActions(): TargetActions {
  const targeting = useTargeting();
  const dispatch = useUiDispatch();
  const setTargeting = useSetTargeting();

  function apply(action: UiAction, targeting: Targeting): void {
    dispatch(action);
    setTargeting.mutate(targeting);
  }

  function setTarget(next: Targeting): void {
    const prChanged = next.pr !== targeting.pr;
    if (prChanged) dispatch({ type: 'target/pr', pr: next.pr });
    if (next.commit !== (prChanged ? null : targeting.commit)) {
      dispatch({ type: 'target/commit', sha: next.commit });
    }
    dispatch({ type: 'target/path', path: next.path });
    setTargeting.mutate(next);
  }

  return {
    setTarget,
    setPr: (pr) =>
      apply(
        { type: 'target/pr', pr },
        pr === targeting.pr ? targeting : { pr, commit: null, path: targeting.path },
      ),
    setCommit: (sha) => apply({ type: 'target/commit', sha }, { ...targeting, commit: sha }),
    setPath: (path) => apply({ type: 'target/path', path }, { ...targeting, path }),
  };
}
