import type {
  SourceDocumentSymbol,
  LspDefinitionResult,
  LspDocumentSymbol,
  LspLocation,
  LspPosition,
  LspRange,
  LspSymbolInformation,
  SourcePos,
  SourceRange,
  SourceSymbolKind,
  SymbolKindMapper,
} from '@gepard/common';

export function toLspPosition(pos: SourcePos): LspPosition {
  return { line: pos.line - 1, character: pos.col - 1 };
}

export function toRange(r: LspRange): SourceRange {
  return {
    start: { line: r.start.line + 1, col: r.start.character + 1 },
    end: { line: r.end.line + 1, col: r.end.character + 1 },
  };
}

export function toLocations(raw: LspDefinitionResult | null): LspLocation[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) =>
    'targetUri' in item
      ? { uri: item.targetUri, range: item.targetSelectionRange ?? item.targetRange }
      : item,
  );
}

export function mapLspSymbolKind(k: number): SourceSymbolKind {
  switch (k) {
    case 2:
    case 3:
    case 4:
      return 'namespace';
    case 5:
      return 'class';
    case 11:
      return 'interface';
    case 10:
      return 'enum';
    case 22:
      return 'enumMember';
    case 26:
      return 'typeParameter';
    case 12:
      return 'function';
    case 6:
    case 9:
      return 'method';
    case 7:
    case 8:
      return 'property';
    case 13:
      return 'variable';
    case 14:
      return 'constant';
    default:
      return 'unknown';
  }
}

export function isDocumentSymbolArray(
  raw: LspDocumentSymbol[] | LspSymbolInformation[],
): raw is LspDocumentSymbol[] {
  return raw.length === 0 || 'range' in raw[0];
}

export function toDocumentSymbol(
  s: LspDocumentSymbol,
  kindOf: SymbolKindMapper = mapLspSymbolKind,
): SourceDocumentSymbol {
  return {
    name: s.name,
    kind: kindOf(s.kind),
    range: toRange(s.range),
    selectionRange: toRange(s.selectionRange),
    children: (s.children ?? []).map((child) => toDocumentSymbol(child, kindOf)),
  };
}

export function flatSymbolsToTree(raw: LspSymbolInformation[]): SourceDocumentSymbol[] {
  const nodes = raw.map((s): SourceDocumentSymbol => ({
    name: s.name,
    kind: mapLspSymbolKind(s.kind),
    range: toRange(s.location.range),
    selectionRange: toRange(s.location.range),
    children: [],
  }));
  const byName = new Map<string, SourceDocumentSymbol[]>();
  for (let i = 0; i < raw.length; i++) {
    const list = byName.get(raw[i].name) ?? [];
    list.push(nodes[i]);
    byName.set(raw[i].name, list);
  }
  const roots: SourceDocumentSymbol[] = [];
  for (let i = 0; i < raw.length; i++) {
    const containerName = raw[i].containerName;
    const parentCandidates = containerName ? byName.get(containerName) : undefined;
    const parent = parentCandidates?.find((p) => p !== nodes[i]);
    if (parent) parent.children.push(nodes[i]);
    else roots.push(nodes[i]);
  }
  return roots;
}
