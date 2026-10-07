import type { Anchor, ReviewThread } from '../ipc/schemas/comment';
import type { ForkFields } from '../ipc/schemas/pr';

export function generalCommentAnchor(): Anchor {
  return {
    path: '',
    subjectType: 'PR',
    side: 'RIGHT',
    line: null,
    startLine: null,
    startSide: null,
    originalLine: null,
    originalStartLine: null,
    commitOid: null,
    originalCommitOid: null,
  };
}

export function anchorReference(anchor: Anchor): string | null {
  if (anchor.subjectType === 'PR' || anchor.path === '') return null;
  if (anchor.subjectType === 'FILE' || anchor.line == null) return anchor.path;
  if (anchor.startLine != null && anchor.startLine !== anchor.line)
    return `${anchor.path}:${anchor.startLine}-${anchor.line}`;
  return `${anchor.path}:${anchor.line}`;
}

export function composeIssueDescription(threads: readonly ReviewThread[]): string {
  const ordered = [...threads].sort((a, b) =>
    a.comments[0].createdAt.localeCompare(b.comments[0].createdAt),
  );
  return ordered
    .flatMap((thread) =>
      thread.comments.map((comment, i) => {
        const reference = i === 0 ? anchorReference(thread.anchor) : null;
        const extra = new Set((comment.local?.references ?? []).map((r) => `${r.path}:${r.line}`));
        return [reference, comment.body.trim(), ...extra].filter((l) => l).join('\n');
      }),
    )
    .join('\n\n');
}

export function countComments(threads: readonly ReviewThread[]): number {
  return threads.reduce((n, t) => n + t.comments.length, 0);
}

export function prHeadLabel(
  pr: Pick<ForkFields, 'isCrossRepository' | 'headRepositoryOwner'> & { headRefName: string },
): string {
  if (!pr.isCrossRepository) return pr.headRefName;
  const owner = pr.headRepositoryOwner?.login;
  return owner ? `${owner}:${pr.headRefName}` : pr.headRefName;
}
