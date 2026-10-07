import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './AppContext';
import { useSetViewed, useViewed } from '../queries/comments';
import { useChangedFiles, useTargetedFiles } from '../queries/files';

export function ReviewFilesSync(): null {
  const dispatch = useAppDispatch();
  const { data: viewed } = useViewed();
  const { data: changedFiles } = useChangedFiles();
  const targeted = useTargetedFiles();
  const queue = useAppSelector((s) => s.viewedQueue);
  const { mutate: setViewed } = useSetViewed();

  const files = useMemo(() => {
    const changed = new Set<string>();
    for (const f of changedFiles ?? []) {
      changed.add(f.path);
      if (f.previousPath) changed.add(f.previousPath);
    }
    return {
      targeted,
      changed: [...changed],
      viewed: (viewed ?? []).filter((v) => v.viewed).map((v) => v.path),
    };
  }, [viewed, changedFiles, targeted]);

  useEffect(() => {
    dispatch({ type: 'review/sync', files });
  }, [dispatch, files]);

  useEffect(() => {
    for (const request of queue) {
      setViewed({ paths: request.paths, viewed: request.viewed });
      dispatch({ type: 'viewed/done', id: request.id });
    }
  }, [dispatch, queue, setViewed]);

  return null;
}
