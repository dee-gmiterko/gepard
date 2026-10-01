import type { RowData } from './rowData';

export function isViewedRow(data: RowData): boolean {
  return data.totalCount > 0 && data.viewedCount === data.totalCount;
}

export function hideViewedRows<T extends { data: RowData }>(items: T[], hide: boolean): T[] {
  return hide ? items.filter((item) => !isViewedRow(item.data)) : items;
}
