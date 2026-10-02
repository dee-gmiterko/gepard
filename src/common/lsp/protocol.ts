import type { SourceSymbolKind } from '../extensions/lsp';

export interface LspPosition {
  line: number;
  character: number;
}
export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}
export interface LspLocation {
  uri: string;
  range: LspRange;
}
export interface LspLocationLink {
  targetUri: string;
  targetSelectionRange: LspRange;
  targetRange: LspRange;
}
export interface LspDocumentSymbol {
  name: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}
export interface LspSymbolInformation {
  name: string;
  kind: number;
  location: LspLocation;
  containerName?: string;
}

export type LspDefinitionResult = LspLocation | LspLocationLink | (LspLocation | LspLocationLink)[];

export type SymbolKindMapper = (kind: number) => SourceSymbolKind;
