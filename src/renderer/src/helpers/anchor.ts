import type { Anchor, DraftAnchor } from '@gepard/common';

export interface RefAnchor {
  sha: string;
  path: string;
  line: number;
  symbolsResolvable: boolean;
}

type Checkout = { base: string; head: string } | null;

export function refAnchorFromThread(anchor: Anchor, checkout: Checkout): RefAnchor | null {
  // Must stay in sync with the inline gutter filter in components/CodeEditor.ts.
  if (!checkout || anchor.commitOid !== checkout.head) return null;
  const line = anchor.line ?? anchor.originalLine;
  if (line == null) return null;
  return {
    sha: anchor.side === 'LEFT' ? checkout.base : checkout.head,
    path: anchor.path,
    line,
    symbolsResolvable: anchor.side === 'RIGHT',
  };
}

export function refAnchorFromDraft(draft: DraftAnchor, checkout: Checkout): RefAnchor | null {
  if (draft.line == null || !checkout) return null;
  const left = draft.side === 'LEFT';
  return {
    sha: left ? checkout.base : checkout.head,
    path: draft.path,
    line: draft.line,
    symbolsResolvable: !left,
  };
}
