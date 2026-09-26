// Resolves the (sha, path, line) the reference quick-selects anchor on, from
// either an existing thread's anchor (report 01 §7 `Anchor`) or a draft
// anchor for a new thread (report 01 §7 `DraftAnchor`). Outdated threads
// have `line: null` (current head has moved on) but keep `originalLine` at
// `originalCommitOid` (report 01 §3.2) — fall back to that so references can
// still be built from the commit the comment was actually left on. FILE
// threads and fully-outdated-with-no-original-line anchors have no line to
// anchor on: callers hide the references panel in that case.
//
// A LEFT-side line numbers the base version of the file. The language
// session only sees the working tree (the checked-out head), so symbols are
// only resolvable for a RIGHT-side line at the checked-out head (`symbols`).
import type { Anchor, DraftAnchor } from '@shared/ipc/schemas/comment'

export interface RefAnchor {
  sha: string
  path: string
  line: number
  /** The line is in the working tree, so the LSP can resolve its symbols. */
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
