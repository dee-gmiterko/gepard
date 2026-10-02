export interface RowData {
  additions: number;
  deletions: number;
  viewedCount: number;
  totalCount: number;
}

export const ZERO_ROW: RowData = { additions: 0, deletions: 0, viewedCount: 0, totalCount: 0 };

export function aggregateRows(children: RowData[]): RowData {
  return children.reduce(
    (sum, c) => ({
      additions: sum.additions + c.additions,
      deletions: sum.deletions + c.deletions,
      viewedCount: sum.viewedCount + c.viewedCount,
      totalCount: sum.totalCount + c.totalCount,
    }),
    ZERO_ROW,
  );
}

export function isViewedRow(data: RowData): boolean {
  return data.totalCount > 0 && data.viewedCount === data.totalCount;
}

export function hideViewedRows<T extends { data: RowData }>(items: T[], hide: boolean): T[] {
  return hide ? items.filter((item) => !isViewedRow(item.data)) : items;
}
