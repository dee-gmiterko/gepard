import type { DefinitionResult } from '@gepard/common';
import type { HoveredSymbol, SymbolPopupEntry, SymbolPortal, SymbolResolver } from './CodeEditor';

// Only one hover popup is open at a time; the React content is portalled into its DOM.
export class SymbolPortals {
  private current: SymbolPortal | null = null;
  private listeners = new Set<() => void>();
  private nextKey = 1;
  private resolver: SymbolResolver = () => Promise.resolve([]);

  // Swapped from an effect so the CodeMirror extension itself can stay stable.
  setResolver(resolver: SymbolResolver): void {
    this.resolver = resolver;
  }

  resolve(symbol: HoveredSymbol): Promise<DefinitionResult['definitions']> {
    return this.resolver(symbol);
  }

  set(dom: HTMLElement, entry: SymbolPopupEntry): void {
    this.current = { key: this.nextKey++, dom, entry };
    this.emit();
  }

  remove(dom: HTMLElement): void {
    if (this.current?.dom !== dom) return;
    this.current = null;
    this.emit();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SymbolPortal | null => this.current;

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
