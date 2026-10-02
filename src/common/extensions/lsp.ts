import type { Match, Pos, WorkspaceSymbol } from '../ipc/schemas/search';
import type { GrammarLanguage } from '../ipc/schemas/grammar';
import type { DefinitionTarget, DocumentSymbol, IndexStatus, LineSymbol } from '../ipc/schemas/lsp';

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface FileReferences {
  path: string;
  matches: Match[];
}

export interface FileChange {
  path: string;
  type: 'created' | 'changed' | 'deleted';
}

export interface ExtensionEvents {
  status(s: IndexStatus): void;
  log(level: 'info' | 'warn' | 'error', msg: string): void;
}

export interface ExtensionHost {
  dataDir: string;
}

export interface LanguageSession {
  lineSymbols(filePath: string, line: number, token?: CancellationToken): Promise<LineSymbol[]>;
  definition(filePath: string, pos: Pos, token?: CancellationToken): Promise<DefinitionTarget[]>;
  references(filePath: string, pos: Pos, token?: CancellationToken): Promise<FileReferences[]>;
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
  languages: GrammarLanguage[];
  warmupFile?(files: string[]): string | undefined;
  open(
    project: { root: string },
    host: ExtensionHost,
    sink: ExtensionEvents,
  ): Promise<LanguageSession>;
}
