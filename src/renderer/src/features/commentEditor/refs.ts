import type { CommentReference } from '@shared/ipc/schemas/comment';

export function sameRef(a: CommentReference, b: CommentReference): boolean {
  return a.kind === b.kind && a.path === b.path && a.line === b.line;
}

export function toggleRefIn(
  references: CommentReference[],
  ref: CommentReference,
): CommentReference[] {
  return references.some((r) => sameRef(r, ref))
    ? references.filter((r) => !sameRef(r, ref))
    : [...references, ref];
}
