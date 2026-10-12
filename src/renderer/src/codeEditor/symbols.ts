import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import type { DefinitionResult } from '@gepard/common';
import type { SymbolPortals } from './SymbolPortals';

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

// `fileLineOf` maps a document line to the file line the symbol lookup expects; null skips the tooltip.
export function symbolTooltip(
  portals: SymbolPortals,
  fileLineOf: (docLine: number) => number | null = (docLine) => docLine,
): Extension {
  return hoverTooltip(
    async (view, pos, side): Promise<Tooltip | null> => {
      const hovered = hoveredSymbol(view.state, pos, side);
      if (!hovered) return null;
      const line = fileLineOf(hovered.line);
      if (line === null) return null;
      const symbol = { ...hovered, line };
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
