import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import type { DefinitionResult } from '@gepard/common';

export interface HoveredSymbol {
  name: string;
  from: number;
  to: number;
  line: number;
  col: number;
}

export interface SymbolPopupEntry {
  symbol: HoveredSymbol;
  definitions: DefinitionResult['definitions'];
}

export interface SymbolPortal {
  key: number;
  dom: HTMLElement;
  entry: SymbolPopupEntry;
}

const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

export function hoveredSymbol(state: EditorState, pos: number, side: -1 | 1): HoveredSymbol | null {
  const word = state.wordAt(pos);
  if (!word || (side < 0 ? pos <= word.from : pos >= word.to)) return null;
  const name = state.sliceDoc(word.from, word.to);
  if (!IDENTIFIER.test(name)) return null;
  if (/Comment|String/.test(syntaxTree(state).resolveInner(pos, side).name)) return null;
  const line = state.doc.lineAt(word.from);
  return { name, from: word.from, to: word.to, line: line.number, col: word.from - line.from + 1 };
}

export type SymbolResolver = (symbol: HoveredSymbol) => Promise<DefinitionResult['definitions']>;

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

export function symbolTooltip(portals: SymbolPortals): Extension {
  return hoverTooltip(
    async (view, pos, side): Promise<Tooltip | null> => {
      const symbol = hoveredSymbol(view.state, pos, side);
      if (!symbol) return null;
      const definitions = await portals.resolve(symbol);
      if (definitions.length === 0) return null;
      return {
        pos: symbol.from,
        end: symbol.to,
        create: () => {
          const dom = document.createElement('div');
          dom.className = 'cm-symbol-popup';
          portals.set(dom, { symbol, definitions });
          return { dom, destroy: () => portals.remove(dom) };
        },
      };
    },
    { hoverTime: 350, hideOnChange: true },
  );
}
