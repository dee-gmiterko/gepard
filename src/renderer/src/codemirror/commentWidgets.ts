// Inline comments shared by the code and diff viewers (spec: "Shows inline
// comments"; a gutter affordance on hover starts a new thread at
// {side, line} when a PR is targeted). Each commented line gets a block
// widget whose DOM node is only a mount point: the viewer renders the thread
// UI into it with a React portal (report 02: "Comment widgets as React
// portals in block decorations"), so the widgets live inside the app's React
// tree and see its providers (query client, theme, AppContext). The widgets
// publish their mount points through `CommentPortals`, which the viewer
// subscribes to.
import type { Text, Extension } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, WidgetType, gutter } from '@codemirror/view'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Plus } from 'react-feather'
import type { DraftAnchor, ReviewThread } from '@shared/ipc/schemas/comment'

/** One document line (1-based) with the threads anchored there and/or an
 * in-progress draft for a new thread. */
export interface LineCommentEntry {
  docLine: number
  threads: ReviewThread[]
  draft: DraftAnchor | null
}

export interface CommentPortal {
  key: number
  dom: HTMLElement
  entry: LineCommentEntry
}

/** Mount points of the currently drawn comment widgets, as an external store
 * for `useSyncExternalStore`. CodeMirror may draw one widget more than once
 * (a line scrolled out and back in), so entries are keyed by DOM node. */
export class CommentPortals {
  private byDom = new Map<HTMLElement, CommentPortal>()
  private snapshot: CommentPortal[] = []
  private listeners = new Set<() => void>()
  private nextKey = 1

  add(dom: HTMLElement, entry: LineCommentEntry): void {
    this.byDom.set(dom, { key: this.nextKey++, dom, entry })
    this.emit()
  }

  /** Same mount point, new content: the portal keeps its key, so React
   * keeps the widget's state (e.g. a half-typed reply) across refetches. */
  update(dom: HTMLElement, entry: LineCommentEntry): boolean {
    const current = this.byDom.get(dom)
    if (!current) return false
    this.byDom.set(dom, { ...current, entry })
    this.emit()
    return true
  }

  remove(dom: HTMLElement): void {
    if (this.byDom.delete(dom)) this.emit()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): CommentPortal[] => this.snapshot

  private emit(): void {
    this.snapshot = [...this.byDom.values()]
    for (const l of this.listeners) l()
  }
}

const resizeObservers = new WeakMap<HTMLElement, ResizeObserver>()

class ThreadBlockWidget extends WidgetType {
  constructor(
    private readonly portals: CommentPortals,
    private readonly entry: LineCommentEntry
  ) {
    super()
  }

  eq(other: ThreadBlockWidget): boolean {
    return (
      this.portals === other.portals &&
      this.entry.threads === other.entry.threads &&
      this.entry.draft === other.entry.draft
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement('div')
    dom.className = 'cm-comment-widget'
    // The portal content renders after this returns and changes height as
    // the user types or expands accordions; keep CodeMirror's height map in
    // sync with it.
    const observer = new ResizeObserver(() => view.requestMeasure())
    observer.observe(dom)
    resizeObservers.set(dom, observer)
    this.portals.add(dom, this.entry)
    return dom
  }

  updateDOM(dom: HTMLElement): boolean {
    return this.portals.update(dom, this.entry)
  }

  destroy(dom: HTMLElement): void {
    resizeObservers.get(dom)?.disconnect()
    resizeObservers.delete(dom)
    this.portals.remove(dom)
  }

  ignoreEvent(): boolean {
    return true
  }
}

/** Block widgets below each commented (or drafted) line, keyed to the
 * document's line numbers. */
export function commentBlockDecorations(
  doc: Text,
  entries: readonly LineCommentEntry[],
  portals: CommentPortals
): Extension {
  const relevant = entries.filter((e) => e.threads.length > 0 || e.draft !== null)
  const sorted = [...relevant].sort((a, b) => a.docLine - b.docLine)
  const builder = new RangeSetBuilder<Decoration>()
  for (const entry of sorted) {
    if (entry.docLine < 1 || entry.docLine > doc.lines) continue
    const line = doc.line(entry.docLine)
    const widget = new ThreadBlockWidget(portals, entry)
    builder.add(line.to, line.to, Decoration.widget({ widget, block: true, side: 1 }))
  }
  return EditorView.decorations.of(builder.finish())
}

// Gutter markers are plain DOM built by CodeMirror, outside the React tree:
// the feather icon (spec Styling) is rendered to markup once and reused.
let plusIconMarkup: string | null = null

class AffordanceMarker extends GutterMarker {
  eq(other: AffordanceMarker): boolean {
    return other instanceof AffordanceMarker
  }
  toDOM(): HTMLElement {
    plusIconMarkup ??= renderToStaticMarkup(createElement(Plus, { size: 12 }))
    const span = document.createElement('span')
    span.className = 'cm-comment-affordance'
    span.innerHTML = plusIconMarkup
    return span
  }
}

/** The plus icon that appears on gutter hover to start a new thread (spec). Only
 * mounted when a PR is targeted; `isCommentable` excludes rows with no valid
 * anchor on either side (e.g. a diff hunk header). */
export function commentAffordanceGutter(
  isCommentable: (docLine: number) => boolean,
  onClick: (docLine: number) => void
): Extension {
  return gutter({
    class: 'cm-comment-gutter',
    lineMarker: (view, line) => {
      const docLine = view.state.doc.lineAt(line.from).number
      return isCommentable(docLine) ? new AffordanceMarker() : null
    },
    initialSpacer: () => new AffordanceMarker(),
    domEventHandlers: {
      click: (view, line) => {
        const docLine = view.state.doc.lineAt(line.from).number
        if (!isCommentable(docLine)) return false
        onClick(docLine)
        return true
      }
    }
  })
}

/** Code-view mapping: threads/drafts always anchor RIGHT (the file has one
 * version, the current head). */
export function codeViewCommentEntries(
  threads: readonly ReviewThread[],
  path: string,
  draftLine: number | null
): LineCommentEntry[] {
  const byLine = new Map<number, ReviewThread[]>()
  for (const t of threads) {
    if (t.anchor.path !== path || t.anchor.subjectType !== 'LINE') continue
    if (t.anchor.side !== 'RIGHT' || t.anchor.line == null) continue
    const list = byLine.get(t.anchor.line) ?? []
    list.push(t)
    byLine.set(t.anchor.line, list)
  }
  const entries: LineCommentEntry[] = [...byLine.entries()].map(([docLine, lineThreads]) => ({
    docLine,
    threads: lineThreads,
    draft: null
  }))
  if (draftLine != null) {
    const draft: DraftAnchor = {
      path,
      subjectType: 'LINE',
      side: 'RIGHT',
      line: draftLine,
      startLine: null,
      startSide: null
    }
    const existing = entries.find((e) => e.docLine === draftLine)
    if (existing) existing.draft = draft
    else entries.push({ docLine: draftLine, threads: [], draft })
  }
  return entries
}

/** Diff-view mapping: a thread's `{side, line}` anchor is translated to the
 * combined document's line number via the row `oldLine`/`newLine` fields
 * (report 02: "mapping from a row back to LEFT/RIGHT line numbers ... is
 * correct"). */
export function diffViewCommentEntries(
  threads: readonly ReviewThread[],
  path: string,
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  draft: { docLine: number; side: 'LEFT' | 'RIGHT' } | null
): LineCommentEntry[] {
  const oldToDoc = new Map<number, number>()
  const newToDoc = new Map<number, number>()
  infos.forEach((info, i) => {
    if (info.oldLine != null) oldToDoc.set(info.oldLine, i + 1)
    if (info.newLine != null) newToDoc.set(info.newLine, i + 1)
  })

  const byLine = new Map<number, ReviewThread[]>()
  for (const t of threads) {
    if (t.anchor.path !== path || t.anchor.subjectType !== 'LINE' || t.anchor.line == null) continue
    const docLine = (t.anchor.side === 'LEFT' ? oldToDoc : newToDoc).get(t.anchor.line)
    if (docLine == null) continue
    const list = byLine.get(docLine) ?? []
    list.push(t)
    byLine.set(docLine, list)
  }

  const entries: LineCommentEntry[] = [...byLine.entries()].map(([docLine, lineThreads]) => ({
    docLine,
    threads: lineThreads,
    draft: null
  }))

  if (draft) {
    const info = infos[draft.docLine - 1]
    const line = draft.side === 'LEFT' ? (info?.oldLine ?? null) : (info?.newLine ?? null)
    if (line != null) {
      const draftAnchor: DraftAnchor = {
        path,
        subjectType: 'LINE',
        side: draft.side,
        line,
        startLine: null,
        startSide: null
      }
      const existing = entries.find((e) => e.docLine === draft.docLine)
      if (existing) existing.draft = draftAnchor
      else entries.push({ docLine: draft.docLine, threads: [], draft: draftAnchor })
    }
  }

  return entries
}
