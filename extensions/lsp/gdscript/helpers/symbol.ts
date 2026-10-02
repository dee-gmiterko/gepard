import type { SourceDocumentSymbol, SourcePos, SourceSymbolKind } from '@gepard/common';
import { mapLspSymbolKind } from './lsp';

// Godot reports signals as LSP Event symbols.
export function symbolKind(k: number): SourceSymbolKind {
  return k === 24 ? 'property' : mapLspSymbolKind(k);
}

export function unwrapFileSymbol(tree: SourceDocumentSymbol[]): SourceDocumentSymbol[] {
  if (tree.length === 1 && tree[0].kind === 'class' && tree[0].range.start.line === 1) {
    return tree[0].children;
  }
  return tree;
}

export function findSymbolAt(
  symbols: SourceDocumentSymbol[],
  pos: SourcePos,
): SourceDocumentSymbol | null {
  for (const s of symbols) {
    if (s.selectionRange.start.line === pos.line && s.selectionRange.start.col === pos.col)
      return s;
    const inner = findSymbolAt(s.children, pos);
    if (inner) return inner;
  }
  return null;
}
