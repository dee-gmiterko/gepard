// Symbol / index-status schemas — report 03 §7 verbatim.
import { z } from 'zod'
import { Location, Range, RepoPath, SymbolKind } from './search'

export const LineSymbol = z.object({
  name: z.string(),
  kind: SymbolKind,
  modifiers: z
    .array(z.enum(['declaration', 'readonly', 'static', 'async', 'local', 'defaultLibrary']))
    .default([]),
  range: Range
})
export const LineSymbolsResult = z.object({
  path: RepoPath,
  line: z.int().positive(),
  symbols: z.array(LineSymbol)
})
export type LineSymbolsResult = z.infer<typeof LineSymbolsResult>

export const DefinitionTarget = z.object({
  location: Location,
  name: z.string().optional(),
  kind: SymbolKind.optional(),
  containerName: z.string().optional(),
  external: z.boolean().default(false) // outside repo -> not referenceable
})
export const DefinitionResult = z.object({
  symbol: z.string(),
  definitions: z.array(DefinitionTarget)
})
export type DefinitionResult = z.infer<typeof DefinitionResult>

export const IndexStatus = z.discriminatedUnion('state', [
  z.object({ state: z.literal('idle'), commit: z.string(), files: z.int() }),
  z.object({
    state: z.literal('indexing'),
    phase: z.enum(['files', 'language']),
    done: z.int(),
    total: z.int().optional()
  }),
  z.object({ state: z.literal('error'), message: z.string() })
])
export type IndexStatus = z.infer<typeof IndexStatus>
