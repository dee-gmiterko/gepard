import type { CommentReference, DiffSide, DraftAnchor, ReviewThread } from '@gepard/common';

export interface LineCommentEntry {
  docLine: number;
  threads: ReviewThread[];
  draft: DraftAnchor | null;
}

export function sortThreadsChronologically(threads: readonly ReviewThread[]): ReviewThread[] {
  return [...threads].sort((a, b) =>
    a.comments[0].createdAt.localeCompare(b.comments[0].createdAt),
  );
}

export function codeViewCommentEntries(
  threads: readonly ReviewThread[],
  path: string,
  draftLine: number | null,
  head: string,
): LineCommentEntry[] {
  const byLine = new Map<number, ReviewThread[]>();
  for (const t of threads) {
    if (
      t.anchor.path !== path ||
      t.anchor.subjectType !== 'LINE' ||
      t.anchor.side !== 'RIGHT' ||
      t.anchor.line == null
    )
      continue;
    if (t.isOutdated || t.anchor.commitOid !== head) continue;
    const list = byLine.get(t.anchor.line) ?? [];
    list.push(t);
    byLine.set(t.anchor.line, list);
  }

  const entries: LineCommentEntry[] = [...byLine.entries()].map(([docLine, lineThreads]) => ({
    docLine,
    threads: lineThreads,
    draft: null,
  }));

  if (draftLine != null) {
    const draftAnchor: DraftAnchor = {
      path,
      subjectType: 'LINE',
      side: 'RIGHT',
      line: draftLine,
      startLine: null,
      startSide: null,
    };
    const existing = entries.find((e) => e.docLine === draftLine);
    if (existing) existing.draft = draftAnchor;
    else entries.push({ docLine: draftLine, threads: [], draft: draftAnchor });
  }

  return entries;
}

export function diffViewCommentEntries(
  threads: readonly ReviewThread[],
  path: string,
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  draft: { docLine: number; side: DiffSide } | null,
  head: string,
): LineCommentEntry[] {
  const oldToDoc = new Map<number, number>();
  const newToDoc = new Map<number, number>();
  infos.forEach((info, i) => {
    if (info.oldLine != null) oldToDoc.set(info.oldLine, i + 1);
    if (info.newLine != null) newToDoc.set(info.newLine, i + 1);
  });

  const byLine = new Map<number, ReviewThread[]>();
  for (const t of threads) {
    if (t.anchor.path !== path || t.anchor.subjectType !== 'LINE' || t.anchor.line == null)
      continue;
    if (t.isOutdated || t.anchor.commitOid !== head) continue;
    const docLine = (t.anchor.side === 'LEFT' ? oldToDoc : newToDoc).get(t.anchor.line);
    if (docLine == null) continue;
    const list = byLine.get(docLine) ?? [];
    list.push(t);
    byLine.set(docLine, list);
  }

  const entries: LineCommentEntry[] = [...byLine.entries()].map(([docLine, lineThreads]) => ({
    docLine,
    threads: lineThreads,
    draft: null,
  }));

  if (draft) {
    const info = infos[draft.docLine - 1];
    const line = draft.side === 'LEFT' ? (info?.oldLine ?? null) : (info?.newLine ?? null);
    if (line != null) {
      const draftAnchor: DraftAnchor = {
        path,
        subjectType: 'LINE',
        side: draft.side,
        line,
        startLine: null,
        startSide: null,
      };
      const existing = entries.find((e) => e.docLine === draft.docLine);
      if (existing) existing.draft = draftAnchor;
      else entries.push({ docLine: draft.docLine, threads: [], draft: draftAnchor });
    }
  }

  return entries;
}

export function fileReference(path: string): CommentReference {
  return { path, line: 1, kind: 'symbol' };
}

export function generalThreadsReferencingFile(
  threads: readonly ReviewThread[],
  path: string,
): ReviewThread[] {
  const prefix = `${path}:`;
  return threads.filter(
    (t) =>
      t.anchor.subjectType === 'PR' &&
      t.comments.some(
        (c) =>
          c.local?.references.some((r) => r.path === path) ||
          c.body
            .split('\n')
            .some((l) => l.startsWith(prefix) && /^\d+$/.test(l.slice(prefix.length))),
      ),
  );
}
