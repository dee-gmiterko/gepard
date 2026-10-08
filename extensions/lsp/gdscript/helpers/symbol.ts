import type { SourceDocumentSymbol, SourceSymbolKind } from '@gepard/common';
import { mapLspSymbolKind } from '@gepard/common-lsp';

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
