import type { Anchor, DraftAnchor } from '@shared/ipc/schemas/comment'

export interface RefAnchor {
  sha: string
  path: string
  line: number
  symbolsResolvable: boolean
}

type Checkout = { base: string; head: string } | null

export function refAnchorFromThread(anchor: Anchor, checkout: Checkout): RefAnchor | null {
  // Matches the inline gutter rule (codemirror/commentWidgets.ts): only
  // resolve a thread anchored at the checked-out commit. `base` is only the
  // right ancestor for a LEFT-side line when it belongs to that commit.
  if (!checkout || anchor.commitOid !== checkout.head) return null
  const line = anchor.line ?? anchor.originalLine
  if (line == null) return null
  return {
    sha: anchor.side === 'LEFT' ? checkout.base : checkout.head,
    path: anchor.path,
    line,
    symbolsResolvable: anchor.side === 'RIGHT'
  }
}

export function refAnchorFromDraft(draft: DraftAnchor, checkout: Checkout): RefAnchor | null {
  if (draft.line == null || !checkout) return null
  const left = draft.side === 'LEFT'
  return {
    sha: left ? checkout.base : checkout.head,
    path: draft.path,
    line: draft.line,
    symbolsResolvable: !left
  }
}
