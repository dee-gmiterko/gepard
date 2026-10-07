import { useEffect } from 'react';
import { useAppDispatch } from '../../state/AppContext';
import { useProjectId, useTargeting } from '../../state/hooks';
import { useCheckoutTarget } from '../../queries/prs';
import { useSync } from '../../queries/comments';
import { activeTargetRef } from '../../state/selectors';
import type { TargetRef } from '@gepard/common';

interface TargetingEffectsStatus {
  pending: boolean;
}

export function useTargetingEffects(): TargetingEffectsStatus {
  const targeting = useTargeting();
  const dispatch = useAppDispatch();
  const projectId = useProjectId();
  const { pr, commit } = targeting;

  const { checkout: checkoutTarget, pending: checkoutPending } = useCheckoutTarget();
  const { mutate: syncRun, reset: syncReset } = useSync();

  useEffect(() => {
    if (!projectId) return;

    const active = activeTargetRef({ pr, commit });
    const target: TargetRef = active ?? { kind: 'default' };

    dispatch({ type: 'target/checkoutHeadResult', checkoutHead: null });
    syncReset();

    let cancelled = false;
    checkoutTarget(target)
      .then((result) => {
        if (cancelled || !active) return;
        dispatch({ type: 'target/checkoutHeadResult', checkoutHead: result });
        // Refreshing from origin runs after content is already showing, so it
        // must not feed into the blocking "Checking out…" status below.
        if (pr !== null) syncRun('pull');
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [projectId, pr, commit, dispatch, checkoutTarget, syncRun, syncReset]);

  return { pending: checkoutPending };
}
