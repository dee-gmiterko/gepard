import { z } from 'zod';
import { Location, Range, RepoPath, SymbolKind } from './search';

export const LineSymbol = z.object({
  name: z.string(),
  kind: SymbolKind,
  // The bundled TypeScript 7 native LSP reports only standard LSP 3.17 token modifiers.
  modifiers: z
    .array(z.enum(['declaration', 'readonly', 'static', 'async', 'defaultLibrary']))
    .default([]),
  range: Range,
});
export const LineSymbolsResult = z.object({
  path: RepoPath,
  line: z.int().positive(),
  symbols: z.array(LineSymbol),
});
export type LineSymbolsResult = z.infer<typeof LineSymbolsResult>;

export interface DocumentSymbol {
  name: string;
  kind: z.infer<typeof SymbolKind>;
  range: z.infer<typeof Range>;
  selectionRange: z.infer<typeof Range>;
  children: DocumentSymbol[];
}
export const DocumentSymbol: z.ZodType<DocumentSymbol> = z.lazy(() =>
  z.object({
    name: z.string(),
    kind: SymbolKind,
    range: Range,
    selectionRange: Range,
    children: z.array(DocumentSymbol),
  }),
);
export const DocumentSymbolsResult = z.object({
  path: RepoPath,
  symbols: z.array(DocumentSymbol),
});
export type DocumentSymbolsResult = z.infer<typeof DocumentSymbolsResult>;

export const DefinitionTarget = z.object({
  location: Location,
  external: z.boolean().default(false),
});
export const DefinitionResult = z.object({
  symbol: z.string(),
  definitions: z.array(DefinitionTarget),
});
export type DefinitionResult = z.infer<typeof DefinitionResult>;

export const IndexStatus = z.discriminatedUnion('state', [
  z.object({ state: z.literal('idle') }),
  z.object({
    state: z.literal('indexing'),
    phase: z.enum(['files', 'language']),
    done: z.int(),
    total: z.int().optional(),
  }),
  z.object({ state: z.literal('error'), message: z.string() }),
]);
export type IndexStatus = z.infer<typeof IndexStatus>;
