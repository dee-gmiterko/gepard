// The language session only indexes the working tree at the checked-out
// head, so symbols are only resolvable for a RIGHT-side line at that head,
// never for a LEFT-side (base version) line.
import type { Anchor, DraftAnchor } from '@shared/ipc/schemas/comment'

export interface RefAnchor {
  sha: string
  path: string
  line: number
  symbols: boolean
}

type Checkout = { base: string; head: string } | null

export function refAnchorFromThread(anchor: Anchor, checkout: Checkout): RefAnchor | null {
  const line = anchor.line ?? anchor.originalLine
  if (line == null) return null
  const sha =
    anchor.side === 'LEFT'
      ? (checkout?.base ?? null)
      : anchor.line != null
        ? (anchor.commitOid ?? anchor.originalCommitOid)
        : anchor.originalCommitOid
  if (!sha) return null
  return {
    sha,
    path: anchor.path,
    line,
    symbols: anchor.side === 'RIGHT' && sha === checkout?.head
  }
}

export function refAnchorFromDraft(draft: DraftAnchor, checkout: Checkout): RefAnchor | null {
  if (draft.line == null || !checkout) return null
  const left = draft.side === 'LEFT'
  return {
    sha: left ? checkout.base : checkout.head,
    path: draft.path,
    line: draft.line,
    symbols: !left
  }
}
