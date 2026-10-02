import type { ReviewThread } from '@gepard/common';

export function sortThreadsChronologically(threads: readonly ReviewThread[]): ReviewThread[] {
  return [...threads].sort((a, b) =>
    a.comments[0].createdAt.localeCompare(b.comments[0].createdAt),
  );
}
