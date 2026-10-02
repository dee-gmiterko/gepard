import { z } from 'zod';
import type { ExtensionLanguage } from './language';

export interface SourcePos {
  line: number;
  col: number;
}

export interface SourceRange {
  start: SourcePos;
  end: SourcePos;
}

export interface SourceLocation {
  path: string;
  range: SourceRange;
}

export const SourceSymbolKind = z.enum([
  'namespace',
  'class',
  'interface',
  'enum',
  'enumMember',
  'type',
  'typeParameter',
  'function',
  'method',
  'property',
  'variable',
  'parameter',
  'constant',
  'unknown',
]);
export type SourceSymbolKind = z.infer<typeof SourceSymbolKind>;

export const SourceSymbolModifier = z.enum([
  'declaration',
  'readonly',
  'static',
  'async',
  'defaultLibrary',
]);
export type SourceSymbolModifier = z.infer<typeof SourceSymbolModifier>;

export const ExtensionIndexPhase = z.enum(['files', 'language']);
export type ExtensionIndexPhase = z.infer<typeof ExtensionIndexPhase>;

export const FileChangeType = z.enum(['created', 'changed', 'deleted']);
export type FileChangeType = z.infer<typeof FileChangeType>;

export const ExtensionLogLevel = z.enum(['info', 'warn', 'error']);
export type ExtensionLogLevel = z.infer<typeof ExtensionLogLevel>;

export interface SourceMatch {
  line: number;
  preview: string;
  spans: [number, number][];
}

export interface SourceLineSymbol {
  name: string;
  kind: SourceSymbolKind;
  modifiers: SourceSymbolModifier[];
  range: SourceRange;
}

export interface SourceDocumentSymbol {
  name: string;
  kind: SourceSymbolKind;
  range: SourceRange;
  selectionRange: SourceRange;
  children: SourceDocumentSymbol[];
}

export interface SourceWorkspaceSymbol {
  name: string;
  kind: SourceSymbolKind;
  containerName?: string;
  location: SourceLocation;
}

export interface SourceDefinition {
  location: SourceLocation;
  external: boolean;
}

export type ExtensionStatus =
  | { state: 'idle' }
  | { state: 'indexing'; phase: ExtensionIndexPhase; done: number; total?: number }
  | { state: 'error'; message: string };

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface FileReferences {
  path: string;
  matches: SourceMatch[];
}

export interface FileChange {
  path: string;
  type: FileChangeType;
}

export interface ExtensionEvents {
  status(s: ExtensionStatus): void;
  log(level: ExtensionLogLevel, msg: string): void;
}

export interface ExtensionHost {
  dataDir: string;
}

export interface LanguageSession {
  lineSymbols(
    filePath: string,
    line: number,
    token?: CancellationToken,
  ): Promise<SourceLineSymbol[]>;
  definition(
    filePath: string,
    pos: SourcePos,
    token?: CancellationToken,
  ): Promise<SourceDefinition[]>;
  references(
    filePath: string,
    pos: SourcePos,
    token?: CancellationToken,
  ): Promise<FileReferences[]>;
  workspaceSymbols(
    query: string,
    limit: number,
    token?: CancellationToken,
  ): Promise<SourceWorkspaceSymbol[]>;
  documentSymbols(filePath: string, token?: CancellationToken): Promise<SourceDocumentSymbol[]>;
  filesChanged(changes: FileChange[]): void;
  dispose(): Promise<void>;
}

export interface LanguageExtension {
  id: string;
  displayName: string;
  languages: ExtensionLanguage[];
  warmupFile?(files: string[]): string | undefined;
  open(
    project: { root: string },
    host: ExtensionHost,
    sink: ExtensionEvents,
  ): Promise<LanguageSession>;
}
