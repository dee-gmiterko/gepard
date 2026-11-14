export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export async function* paginateGraphql<P>(
  fetchPage: (cursor: string | null) => Promise<P>,
  pageInfoOf: (page: P) => PageInfo | null | undefined,
  startCursor: string | null = null,
): AsyncGenerator<P, void, undefined> {
  let cursor = startCursor;
  for (;;) {
    const page = await fetchPage(cursor);
    yield page;
    const info = pageInfoOf(page);
    if (!info?.hasNextPage || !info.endCursor) return;
    cursor = info.endCursor;
  }
}
