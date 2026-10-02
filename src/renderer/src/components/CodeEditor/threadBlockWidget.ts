import { EditorView, WidgetType } from '@codemirror/view';
import type { LineCommentEntry } from '../../helpers/comment';
import type { CommentPortals } from './commentPortals';

const resizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

export class ThreadBlockWidget extends WidgetType {
  constructor(
    private readonly portals: CommentPortals,
    private readonly entry: LineCommentEntry,
  ) {
    super();
  }

  eq(other: ThreadBlockWidget): boolean {
    return (
      this.portals === other.portals &&
      this.entry.threads === other.entry.threads &&
      this.entry.draft === other.entry.draft
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'cm-comment-widget';
    // CodeMirror caches each widget's height and does not detect content resizes.
    const observer = new ResizeObserver(() => view.requestMeasure());
    observer.observe(dom);
    resizeObservers.set(dom, observer);
    this.portals.add(dom, this.entry);
    return dom;
  }

  updateDOM(dom: HTMLElement): boolean {
    return this.portals.update(dom, this.entry);
  }

  destroy(dom: HTMLElement): void {
    resizeObservers.get(dom)?.disconnect();
    resizeObservers.delete(dom);
    this.portals.remove(dom);
  }

  ignoreEvent(): boolean {
    return true;
  }
}
