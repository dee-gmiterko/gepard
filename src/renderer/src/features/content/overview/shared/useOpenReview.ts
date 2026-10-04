import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppState } from '../../../../state/AppContext';
import { activeTargetRef } from '../../../../state/selectors';
import type { Targeting } from '../../../../state/reducer';
import { useCheckoutTarget } from '../../../../queries/prs';
import { changedFilesQuery, targetedFilePaths } from '../../../../queries/files';
import { viewedQuery } from '../../../../queries/comments';
import { firstFileToReview } from '../../../../helpers/targetedFiles';

export function useOpenReview(): (targeting: Targeting) => void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  const { checkout } = useCheckoutTarget();

  async function firstFile(projectId: string, targeting: Targeting): Promise<string | null> {
    const target = activeTargetRef(targeting);
    if (!target) return null;
    const known =
      state.targeting.pr === targeting.pr && state.targeting.commit === targeting.commit
        ? state.checkout
        : null;
    const { base, head } = known ?? (await checkout(target));
    const [changed, viewed] = await Promise.all([
      qc.ensureQueryData(changedFilesQuery(projectId, base, head)),
      targeting.pr !== null ? qc.ensureQueryData(viewedQuery(projectId, targeting.pr)) : [],
    ]);
    const files = targetedFilePaths(
      changed.map((f) => f.path),
      targeting.path,
    );
    const viewedPaths = new Set(viewed.filter((v) => v.viewed).map((v) => v.path));
    return firstFileToReview(files, viewedPaths);
  }

  return (targeting) => {
    dispatch({ type: 'mainTab/set', tab: 'files' });
    const projectId = state.projectId;
    if (!projectId) return;
    firstFile(projectId, targeting)
      .then((path) => {
        if (path) dispatch({ type: 'review/openFile', targeting, path });
      })
      .catch(() => {});
  };
}
