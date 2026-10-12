import type { LineCommentEntry } from '../helpers/comment';

interface CommentPortal {
  key: number;
  dom: HTMLElement;
  entry: LineCommentEntry;
}

// CodeMirror may recreate a widget's DOM node when a line scrolls out of
// view and back in.
export class CommentPortals {
  private byDom = new Map<HTMLElement, CommentPortal>();
  private snapshot: CommentPortal[] = [];
  private listeners = new Set<() => void>();
  private nextKey = 1;

  add(dom: HTMLElement, entry: LineCommentEntry): void {
    this.byDom.set(dom, { key: this.nextKey++, dom, entry });
    this.emit();
  }

  update(dom: HTMLElement, entry: LineCommentEntry): boolean {
    const current = this.byDom.get(dom);
    if (!current) return false;
    this.byDom.set(dom, { ...current, entry });
    this.emit();
    return true;
  }

  remove(dom: HTMLElement): void {
    if (this.byDom.delete(dom)) this.emit();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CommentPortal[] => this.snapshot;

  private emit(): void {
    this.snapshot = [...this.byDom.values()];
    for (const l of this.listeners) l();
  }
}
