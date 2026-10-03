import { useMemo } from 'react';
import { useViewed } from '../../../../queries/comments';

export function useViewedPaths(): ReadonlySet<string> {
  const { data } = useViewed();
  return useMemo(() => new Set((data ?? []).filter((v) => v.viewed).map((v) => v.path)), [data]);
}
