import type { SourceDocumentSymbol, SourcePos } from '@gepard/common';

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
