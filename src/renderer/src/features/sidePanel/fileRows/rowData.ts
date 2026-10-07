import { useCallback, useMemo } from 'react';
import { useCheckout, useIsDiffView } from '../../../state/hooks';
import { useChangedFiles } from '../../../queries/files';
import { useViewed } from '../../../queries/comments';
import type { ChangedFile } from '@gepard/common';
import { ZERO_ROW, type RowData } from '../../../helpers/row';

interface RowDataSource {
  diffMode: boolean;
  changedFiles: ChangedFile[] | undefined;
  changedLoading: boolean;
  rowFor: (path: string) => RowData;
}

export function useRowData(): RowDataSource {
  const checkout = useCheckout();
  const isDiff = useIsDiffView();
  const diffMode = isDiff && checkout !== null;
  const changed = useChangedFiles();
  const { data: viewedList } = useViewed();

  const byPath = useMemo(() => {
    const viewed = new Set((viewedList ?? []).filter((v) => v.viewed).map((v) => v.path));
    const map = new Map<string, RowData>();
    if (!diffMode) return map;
    for (const f of changed.data ?? []) {
      map.set(f.path, {
        additions: f.additions,
        deletions: f.deletions,
        viewedCount: viewed.has(f.path) ? 1 : 0,
        totalCount: 1,
      });
    }
    return map;
  }, [diffMode, changed.data, viewedList]);

  const rowFor = useCallback((path: string): RowData => byPath.get(path) ?? ZERO_ROW, [byPath]);

  return {
    diffMode,
    changedFiles: diffMode ? changed.data : undefined,
    changedLoading: diffMode && changed.isLoading,
    rowFor,
  };
}
