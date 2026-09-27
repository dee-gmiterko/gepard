import { z } from 'zod'
import { RepoPath } from './pr'

export { RepoPath }

export const Pos = z.object({ line: z.int().positive(), col: z.int().positive() })
export const Range = z.object({ start: Pos, end: Pos })
export const Location = z.object({ path: RepoPath, range: Range })
export const SymbolKind = z.enum([
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
  'unknown'
])

export const Match = z.object({
  line: z.int().positive(),
  preview: z.string(),
  spans: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()]))
})
export const FileMatches = z.object({
  path: RepoPath,
  targeted: z.boolean(),
  matches: z.array(Match)
})
export const GroupedResult = z.object({
  query: z.object({
    kind: z.enum(['references', 'exactLine', 'pattern', 'regex', 'fuzzySymbol']),
    text: z.string(),
    scope: z.enum(['all', 'targeted'])
  }),
  files: z.array(FileMatches),
  totalMatches: z.int().nonnegative()
})
export type GroupedResult = z.infer<typeof GroupedResult>

export const WorkspaceSymbol = z.object({
  name: z.string(),
  kind: SymbolKind,
  containerName: z.string().optional(),
  location: Location,
  score: z.number().optional()
})
export type WorkspaceSymbol = z.infer<typeof WorkspaceSymbol>

// `kind` maps to ripgrep flags: pattern -> `rg -F` (`rg -w -F` when word is
// true), regex -> plain `rg` regex, exactLine -> `rg -F` on the trimmed line
// with results filtered to an exact match, references -> LSP
// textDocument/references.
const SearchBase = {
  projectId: z.string(),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  scope: z.enum(['all', 'targeted']),
  targetedPaths: z.array(RepoPath).default([])
}
export const SearchQuery = z.discriminatedUnion('kind', [
  z.object({
    ...SearchBase,
    kind: z.literal('pattern'),
    text: z.string().min(1),
    word: z.boolean().default(false)
  }),
  z.object({ ...SearchBase, kind: z.literal('regex'), text: z.string().min(1) }),
  z.object({
    ...SearchBase,
    kind: z.literal('exactLine'),
    text: z.string().min(1),
    origin: z.object({ path: RepoPath, line: z.int().positive() })
  }),
  z.object({
    ...SearchBase,
    kind: z.literal('references'),
    text: z.string().min(1),
    at: z.object({ path: RepoPath, pos: Pos })
  })
])
export type SearchQuery = z.input<typeof SearchQuery>
