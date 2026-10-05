import { z } from 'zod';
import { RepoPath, Sha } from './pr';
import { ProjectRef } from './refs';

export const Pos = z.object({ line: z.int().positive(), col: z.int().positive() });
export type Pos = z.infer<typeof Pos>;
export const Range = z.object({ start: Pos, end: Pos });
export type Range = z.infer<typeof Range>;
export const Location = z.object({ path: RepoPath, range: Range });
export type Location = z.infer<typeof Location>;
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
  'unknown',
]);
export type SymbolKind = z.infer<typeof SymbolKind>;

export const SearchScope = z.enum(['all', 'targeted']);
export type SearchScope = z.infer<typeof SearchScope>;

export const Match = z.object({
  line: z.int().positive(),
  preview: z.string(),
  spans: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])),
});
export type Match = z.infer<typeof Match>;
export const FileMatches = z.object({
  path: RepoPath,
  moreMatches: z.boolean(),
  matches: z.array(Match),
});
export const GroupedResult = z.object({
  query: z.object({
    kind: z.enum(['references', 'exactLine', 'pattern', 'regex']),
    text: z.string(),
    scope: SearchScope,
  }),
  files: z.array(FileMatches),
  offset: z.int().nonnegative(),
  nextOffset: z.int().nonnegative().nullable(),
  hasMore: z.boolean(),
  truncated: z.boolean(),
  matchesInPage: z.int().nonnegative(),
});
export type GroupedResult = z.infer<typeof GroupedResult>;

export const WorkspaceSymbol = z.object({
  name: z.string(),
  kind: SymbolKind,
  containerName: z.string().optional(),
  location: Location,
});
export type WorkspaceSymbol = z.infer<typeof WorkspaceSymbol>;

const SearchBase = ProjectRef.extend({
  sha: Sha,
  scope: SearchScope,
  targetedPaths: z.array(RepoPath).default([]),
  limit: z.int().positive().max(200).optional(),
  offset: z.int().nonnegative().default(0),
  maxMatchesPerFile: z.int().positive().optional(),
});
export const SearchQuery = z.discriminatedUnion('kind', [
  SearchBase.extend({
    kind: z.literal('pattern'),
    text: z.string().min(1),
    word: z.boolean().default(false),
    caseSensitive: z.boolean().default(false),
  }),
  SearchBase.extend({
    kind: z.literal('regex'),
    text: z.string().min(1),
    caseSensitive: z.boolean().default(false),
  }),
  SearchBase.extend({
    kind: z.literal('exactLine'),
    text: z.string().min(1),
    origin: z.object({ path: RepoPath, line: z.int().positive() }),
  }),
  SearchBase.extend({
    kind: z.literal('references'),
    text: z.string().min(1),
    at: z.object({ path: RepoPath, pos: Pos }),
  }),
]);
export type SearchQuery = z.input<typeof SearchQuery>;
