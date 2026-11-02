import { useMemo } from 'react';
import { usePrViewed } from '../../../../queries/comments';
import { useOverviewPr } from '../../../../state/hooks';

export function useViewedPaths(): ReadonlySet<string> {
  const { data } = usePrViewed(useOverviewPr());
  return useMemo(() => new Set((data ?? []).filter((v) => v.viewed).map((v) => v.path)), [data]);
}
