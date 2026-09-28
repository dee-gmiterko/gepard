import type { ReviewThread } from '@shared/ipc/schemas/comment';

export function sortThreadsChronologically(threads: readonly ReviewThread[]): ReviewThread[] {
  return [...threads].sort((a, b) =>
    a.comments[0].createdAt.localeCompare(b.comments[0].createdAt),
  );
}
