import { useUiDispatch } from '../../../../state/UiContext';
import { useTargeting } from '../../../../state/hooks';
import { useSetTargeting } from '../../../../queries/projects';
import type { Targeting } from '../../../../state/reducer';

export function useRetarget(): (next: Targeting) => void {
  const targeting = useTargeting();
  const dispatch = useUiDispatch();
  const setTargeting = useSetTargeting();

  return (next) => {
    const prChanged = next.pr !== targeting.pr;
    if (prChanged) dispatch({ type: 'target/pr', pr: next.pr });
    if (next.commit !== (prChanged ? null : targeting.commit)) {
      dispatch({ type: 'target/commit', sha: next.commit });
    }
    dispatch({ type: 'target/path', path: next.path });
    setTargeting.mutate(next);
  };
}
