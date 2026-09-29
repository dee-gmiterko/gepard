import { useMemo } from 'react';
import { useAppState } from '../../state/AppContext';
import { useChangedFiles } from '../../queries/files';

export function useIsCheckedOutChangedFile(path: string | null): boolean {
  const checkout = useAppState().checkout;
  const { data: changedFiles } = useChangedFiles();
  return useMemo(() => {
    if (!checkout || !changedFiles || path === null) return false;
    return changedFiles.some((f) => f.path === path || f.previousPath === path);
  }, [checkout, changedFiles, path]);
}
