import { useEffect } from 'react';
import { useAppDispatch, useAppState } from '../../state/AppContext';
import { useViewed } from '../../queries/comments';
import { useChangedFiles, useTargetedFiles } from '../../queries/files';
import { firstFileToReview } from '../../helpers/targetedFiles';
import { isDiffView } from '../../state/selectors';

/**
 * Fulfils `file/openNextWhenReady`: once the target's checkout, changed files and viewed marks
 * have loaded, opens the first unviewed targeted file (the first file when all are viewed).
 */
export function useOpenNextFileWhenReady(): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const pending = state.openNextFilePending;
  const waitsForCheckout = isDiffView(state);
  const waitsForViewed = state.targeting.pr !== null;
  const checkout = state.checkout;
  const changed = useChangedFiles();
  const viewed = useViewed();
  const targetedFiles = useTargetedFiles();

  const ready =
    (!waitsForCheckout || (checkout !== null && !changed.isPending)) &&
    (!waitsForViewed || !viewed.isPending);

  useEffect(() => {
    if (!pending || !ready) return;
    const viewedPaths = new Set(viewed.data?.filter((v) => v.viewed).map((v) => v.path));
    const next = firstFileToReview(targetedFiles, viewedPaths);
    dispatch(next ? { type: 'file/open', path: next } : { type: 'file/openNextCancel' });
  }, [pending, ready, viewed.data, targetedFiles, dispatch]);
}
