// Line/pattern search + symbol-position primitives — report 03 §7 verbatim
// (zod 4.6.5, as printed in the report; `RepoPath` is defined once in
// `./pr.ts` and re-exported here since report 01's file-path fields and
// report 03's both need it).
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

// ---------- search.run input (constructed). One channel for every grouped
// search, so the side-panel search and the comment-editor accordions render
// the same GroupedResult (report 03 §7). `kind` uses GroupedResult's own
// vocabulary:
//   pattern    fixed string, `rg -F` (side-panel "exact match"; with
//              word: true it is the editor's "Same pattern in", `rg -w -F`)
//   regex      `rg` regex (side-panel regex flag)
//   exactLine  whole-line equality (editor "Also in"): `rg -F` on the trimmed
//              line, filtered to preview.trim() === text.trim(), `origin`
//              excluded
//   references LSP textDocument/references at `at` (side-panel symbol flag;
//              `at` comes from the symbols.workspace prefill)
// `targetedPaths` is always sent (files or folder prefixes of the current
// targeting; empty when nothing is targeted): it marks FileMatches.targeted
// and, with scope 'targeted', restricts the search to them. ----------
const SearchBase = {
  projectId: z.string(),
  sha: z.string().regex(/^[0-9a-f]{40}$/), // the checked-out head; cache key + consistency check
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
    text: z.string().min(1), // symbol name, echoed in GroupedResult.query.text
    at: z.object({ path: RepoPath, pos: Pos })
  })
])
export type SearchQuery = z.input<typeof SearchQuery>
