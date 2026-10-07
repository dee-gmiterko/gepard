import type { Anchor, DraftAnchor } from '@gepard/common';

export interface RefAnchor {
  sha: string;
  path: string;
  line: number;
  symbolsResolvable: boolean;
}

type Checkout = { base: string; head: string } | null;

export function refAnchorFromThread(anchor: Anchor, checkoutHead: Checkout): RefAnchor | null {
  // Must stay in sync with the inline gutter filter in components/CodeEditor.ts.
  if (!checkoutHead || anchor.commitOid !== checkoutHead.head) return null;
  const line = anchor.line ?? anchor.originalLine;
  if (line == null) return null;
  return {
    sha: anchor.side === 'LEFT' ? checkoutHead.base : checkoutHead.head,
    path: anchor.path,
    line,
    symbolsResolvable: anchor.side === 'RIGHT',
  };
}

export function refAnchorFromDraft(draft: DraftAnchor, checkoutHead: Checkout): RefAnchor | null {
  if (draft.line == null || !checkoutHead) return null;
  const left = draft.side === 'LEFT';
  return {
    sha: left ? checkoutHead.base : checkoutHead.head,
    path: draft.path,
    line: draft.line,
    symbolsResolvable: !left,
  };
}
