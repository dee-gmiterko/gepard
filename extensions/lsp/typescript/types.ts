export type SymbolKind =
  | 'namespace'
  | 'class'
  | 'interface'
  | 'enum'
  | 'enumMember'
  | 'type'
  | 'typeParameter'
  | 'function'
  | 'method'
  | 'property'
  | 'variable'
  | 'parameter'
  | 'constant'
  | 'unknown';

export interface Pos {
  line: number;
  col: number;
}
export interface Range {
  start: Pos;
  end: Pos;
}
export interface Location {
  path: string;
  range: Range;
}

export interface LineSymbol {
  name: string;
  kind: SymbolKind;
  modifiers: Array<'declaration' | 'readonly' | 'static' | 'async' | 'defaultLibrary'>;
  range: Range;
}
export interface Match {
  line: number;
  preview: string;
  spans: Array<[number, number]>;
}
export interface FileMatches {
  path: string;
  matches: Match[];
}
export interface WorkspaceSymbol {
  name: string;
  kind: SymbolKind;
  containerName?: string;
  location: Location;
}
export interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children: DocumentSymbol[];
}
export interface DefinitionTarget {
  location: Location;
  external: boolean;
}

export interface FileChange {
  path: string;
  type: 'created' | 'changed' | 'deleted';
}

export interface IndexStatus {
  state: 'idle' | 'indexing' | 'error';
  phase?: 'files' | 'language';
  done?: number;
  total?: number;
  message?: string;
}

export interface ExtensionEvents {
  status(s: IndexStatus): void;
  log(level: 'info' | 'warn' | 'error', msg: string): void;
}

export interface ExtensionHost {
  dataDir: string;
}

export interface LanguageSession {
  lineSymbols(filePath: string, line: number, token?: unknown): Promise<LineSymbol[]>;
  definition(filePath: string, pos: Pos, token?: unknown): Promise<DefinitionTarget[]>;
  references(filePath: string, pos: Pos, token?: unknown): Promise<FileMatches[]>;
  workspaceSymbols(query: string, limit: number, token?: unknown): Promise<WorkspaceSymbol[]>;
  documentSymbols(filePath: string, token?: unknown): Promise<DocumentSymbol[]>;
  filesChanged(changes: FileChange[]): void;
  dispose(): Promise<void>;
}
