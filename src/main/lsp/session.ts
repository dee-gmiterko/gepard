import type { CancellationToken } from 'vscode-jsonrpc/node';
import {
  Match as MatchSchema,
  WorkspaceSymbol as WorkspaceSymbolSchema,
  Pos as PosSchema,
  Range as RangeSchema,
  SymbolKind as SymbolKindSchema,
} from '@gepard/common/ipc/schemas/search';
import {
  DefinitionTarget as DefinitionTargetSchema,
  LineSymbol as LineSymbolSchema,
} from '@gepard/common/ipc/schemas/lsp';
import type { IndexStatus, DocumentSymbol } from '@gepard/common/ipc/schemas/lsp';

export type LineSymbol = ReturnType<typeof LineSymbolSchema.parse>;
export type Match = ReturnType<typeof MatchSchema.parse>;
export interface FileMatches {
  path: string;
  matches: Match[];
}
export type WorkspaceSymbol = ReturnType<typeof WorkspaceSymbolSchema.parse>;
export type Pos = ReturnType<typeof PosSchema.parse>;
export type Range = ReturnType<typeof RangeSchema.parse>;
export type SymbolKind = ReturnType<typeof SymbolKindSchema.parse>;
export type DefinitionTarget = ReturnType<typeof DefinitionTargetSchema.parse>;

export interface ExtensionEvents {
  status(s: IndexStatus): void;
  log(level: 'info' | 'warn' | 'error', msg: string): void;
}

export interface ExtensionHost {
  dataDir: string;
}

export interface FileChange {
  path: string;
  type: 'created' | 'changed' | 'deleted';
}

export interface LanguageSession {
  lineSymbols(filePath: string, line: number, token?: CancellationToken): Promise<LineSymbol[]>;
  definition(filePath: string, pos: Pos, token?: CancellationToken): Promise<DefinitionTarget[]>;
  references(filePath: string, pos: Pos, token?: CancellationToken): Promise<FileMatches[]>;
  workspaceSymbols(
    query: string,
    limit: number,
    token?: CancellationToken,
  ): Promise<WorkspaceSymbol[]>;
  documentSymbols(filePath: string, token?: CancellationToken): Promise<DocumentSymbol[]>;
  filesChanged(changes: FileChange[]): void;
  dispose(): Promise<void>;
}

export interface LanguageExtension {
  id: string;
  displayName: string;
  matches(filePath: string): boolean;
  languageId(filePath: string): string;
  warmupFile?(files: string[]): string | undefined;
  open(
    project: { root: string },
    host: ExtensionHost,
    sink: ExtensionEvents,
  ): Promise<LanguageSession>;
}
