export interface ReviewFiles {
  targeted: string[];
  changed: string[];
  viewed: string[];
}

export function canMarkViewed(
  pr: number | null,
  review: Pick<ReviewFiles, 'changed'>,
  path: string | null,
): path is string {
  return pr !== null && path !== null && review.changed.includes(path);
}

export function viewedAfter(
  review: Pick<ReviewFiles, 'viewed'>,
  paths: readonly string[],
  viewed: boolean,
): Set<string> {
  const marked = new Set(review.viewed);
  for (const path of paths) {
    if (viewed) marked.add(path);
    else marked.delete(path);
  }
  return marked;
}
