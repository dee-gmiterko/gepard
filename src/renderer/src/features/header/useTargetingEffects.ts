import { useEffect } from 'react';
import { useAppDispatch, useAppState } from '../../state/AppContext';
import { useCheckoutTarget } from '../../queries/prs';
import { useSync } from '../../queries/comments';
import { activeTargetRef } from '../../state/selectors';
import type { TargetRef } from '@gepard/common/ipc/schemas/pr';

interface TargetingEffectsStatus {
  pending: boolean;
}

export function useTargetingEffects(): TargetingEffectsStatus {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const projectId = state.projectId;
  const { pr, commit } = state.targeting;

  const { mutateAsync: checkoutTarget, isPending: checkoutPending } = useCheckoutTarget();
  const { mutate: syncRun, reset: syncReset, isPending: syncPending } = useSync();

  useEffect(() => {
    if (!projectId) return;

    const active = activeTargetRef({ pr, commit });
    const target: TargetRef = active ?? { kind: 'default' };

    dispatch({ type: 'target/checkoutResult', checkout: null });
    syncReset();

    let cancelled = false;
    checkoutTarget(target)
      .then((result) => {
        if (cancelled || !active) return;
        dispatch({ type: 'target/checkoutResult', checkout: result });
        if (pr !== null) syncRun('pull');
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [projectId, pr, commit, dispatch, checkoutTarget, syncRun, syncReset]);

  return { pending: checkoutPending || syncPending };
}
