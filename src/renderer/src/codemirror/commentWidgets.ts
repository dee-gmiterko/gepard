import type { Text, Extension } from '@codemirror/state'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, WidgetType, gutter } from '@codemirror/view'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Plus } from 'react-feather'
import type { DraftAnchor, ReviewThread } from '@shared/ipc/schemas/comment'
import { defineMessages } from '../i18n/defineMessages'
import { intl } from '../i18n/intl'

const messages = defineMessages({
  addComment: {
    id: 'codemirror.addComment',
    defaultMessage: 'Add comment'
  }
})

interface LineCommentEntry {
  docLine: number
  threads: ReviewThread[]
  draft: DraftAnchor | null
}

interface CommentPortal {
  key: number
  dom: HTMLElement
  entry: LineCommentEntry
}

// CodeMirror may recreate a widget's DOM node when a line scrolls out of
// view and back in.
export class CommentPortals {
  private byDom = new Map<HTMLElement, CommentPortal>()
  private snapshot: CommentPortal[] = []
  private listeners = new Set<() => void>()
  private nextKey = 1

  add(dom: HTMLElement, entry: LineCommentEntry): void {
    this.byDom.set(dom, { key: this.nextKey++, dom, entry })
    this.emit()
  }

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
    // CodeMirror caches each widget's height and does not detect content resizes.
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

// CodeMirror gutter markers are plain DOM outside the React tree.
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
    // CodeMirror handles gutter clicks through a `click` event delegated at
    // the gutter level.
    span.tabIndex = 0
    span.setAttribute('role', 'button')
    span.setAttribute('aria-label', intl.formatMessage(messages.addComment))
    span.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      span.click()
    })
    return span
  }
}

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

export function diffViewCommentEntries(
  threads: readonly ReviewThread[],
  path: string,
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  draft: { docLine: number; side: 'LEFT' | 'RIGHT' } | null,
  head: string
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
    if (t.isOutdated || t.anchor.commitOid !== head) continue
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
