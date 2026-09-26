// Search domain: ripgrep line/pattern search and the LSP-backed symbol
// operations (report 03 §5, §7). `references` goes through the project's
// language session; everything else is a ripgrep spawn.
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import type { HandlerMap } from '../registry'
import { AppError } from '../registry'
import { withLatestWins } from '../cancellation'
import { ripgrepSearch, type RipgrepFileResult } from '../../services/ripgrep'
import { indexer } from '../../lsp'
import type { LanguageSession } from '../../lsp/session'
import { projectRepoDir } from '../../paths'
import { isTargeted } from '@shared/model/paths'

/** Best-effort identifier extraction around a 1-based column, used to fill
 * `DefinitionResult.symbol` (the LSP only gives us the definition targets,
 * not the name of the symbol under the cursor). */
function identifierAt(lineText: string, col1: number): string {
  const idx = col1 - 1
  const isWordChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_$]/.test(c)
  let start = idx
  while (start > 0 && isWordChar(lineText[start - 1])) start--
  let end = idx
  while (isWordChar(lineText[end])) end++
  if (end <= start) return lineText.slice(Math.max(0, idx), idx + 1)
  return lineText.slice(start, end)
}

function requireSession(projectId: string): LanguageSession {
  const session = indexer.session(projectId)
  if (!session) {
    throw new AppError(
      'NO_LANGUAGE_SESSION',
      'No language session is available for this project (still indexing, or no LSP extension matched any file)'
    )
  }
  return session
}

/** The cancellation key must identify "the same logical query" — one UI
 * slot re-issuing a refined/updated request — not just "this channel for
 * this project": several distinct searches run concurrently for one project
 * (the side-panel search box, plus one "Also in"/"Same pattern in" per open
 * comment editor — and several comment editors can be open at once, one per
 * visible thread, each at its own anchor). Concurrent distinct queries must
 * never cancel each other, so the key folds in whatever the request itself
 * says identifies its anchor/slot:
 *  - `pattern`: `word` tells the side-panel's plain pattern search
 *    (`word: false`, a single box: latest-wins per keystroke) apart from the
 *    comment editor's "Same pattern in" (`word: true`). The latter carries no
 *    anchor field and several comment editors can have it open at once on
 *    different symbols, so its key folds in the whole query (scope + text):
 *    only a byte-identical request supersedes it, never another editor's.
 *  - `exactLine`: `origin` (path+line) is the anchor itself.
 *  - `references`: `at` (path+pos) is the symbol position picked in the
 *    side panel's fuzzy prefill.
 *  - `regex`: only the side panel produces these; no anchor to fold in. */
export function searchRunKey(input: {
  projectId: string
  scope: 'all' | 'targeted'
  text: string
  kind: 'pattern' | 'regex' | 'exactLine' | 'references'
  word?: boolean
  origin?: { path: string; line: number }
  at?: { path: string; pos: { line: number; col: number } }
}): string {
  const base = `search.run:${input.projectId}:${input.kind}`
  if (input.kind === 'pattern')
    return input.word ? `${base}:word:${input.scope}:${input.text}` : base
  if (input.kind === 'exactLine') return `${base}:${input.origin!.path}:${input.origin!.line}`
  if (input.kind === 'references')
    return `${base}:${input.at!.path}:${input.at!.pos.line}:${input.at!.pos.col}`
  return base // regex
}

export const searchHandlers: Pick<
  HandlerMap,
  'search.run' | 'symbols.line' | 'symbols.definition' | 'symbols.workspace'
> = {
  'search.run': (input) =>
    withLatestWins(searchRunKey(input), async ({ signal, token }) => {
      const repoRoot = projectRepoDir(input.projectId)
      const targetedPaths = input.targetedPaths

      if (input.kind === 'references') {
        const session = requireSession(input.projectId)
        const raw = await session.references(input.at.path, input.at.pos, token)
        const scoped =
          input.scope === 'targeted' ? raw.filter((f) => isTargeted(f.path, targetedPaths)) : raw
        const files = scoped.map((f) => ({ ...f, targeted: isTargeted(f.path, targetedPaths) }))
        return {
          query: { kind: 'references' as const, text: input.text, scope: input.scope },
          files,
          totalMatches: files.reduce((n, f) => n + f.matches.length, 0)
        }
      }

      // Nothing targeted yet: a "targeted"-scoped search has nothing to search.
      if (input.scope === 'targeted' && targetedPaths.length === 0) {
        return {
          query: { kind: input.kind, text: input.text, scope: input.scope },
          files: [],
          totalMatches: 0
        }
      }

      let rgResults: RipgrepFileResult[]
      if (input.kind === 'pattern') {
        rgResults = await ripgrepSearch({
          cwd: repoRoot,
          pattern: input.text,
          fixedString: true,
          word: input.word,
          paths: input.scope === 'targeted' ? targetedPaths : undefined,
          signal
        })
      } else if (input.kind === 'regex') {
        rgResults = await ripgrepSearch({
          cwd: repoRoot,
          pattern: input.text,
          fixedString: false,
          paths: input.scope === 'targeted' ? targetedPaths : undefined,
          signal
        })
      } else {
        // exactLine ("Also in"): `rg -F` on the trimmed line, filtered to
        // preview.trim() === text.trim(), origin line excluded (report 03 §7).
        const trimmed = input.text.trim()
        const all = await ripgrepSearch({
          cwd: repoRoot,
          pattern: trimmed,
          fixedString: true,
          paths: input.scope === 'targeted' ? targetedPaths : undefined,
          signal
        })
        rgResults = all
          .map((f) => ({
            path: f.path,
            matches: f.matches.filter(
              (m) =>
                m.preview.trim() === trimmed &&
                !(f.path === input.origin.path && m.line === input.origin.line)
            )
          }))
          .filter((f) => f.matches.length > 0)
      }

      const files = rgResults.map((f) => ({
        path: f.path,
        targeted: isTargeted(f.path, targetedPaths),
        matches: f.matches
      }))
      return {
        query: { kind: input.kind, text: input.text, scope: input.scope },
        files,
        totalMatches: files.reduce((n, f) => n + f.matches.length, 0)
      }
    }),

  // Keyed by the full anchor (path + line, not just path): several comment
  // editors, each at its own anchor, can be open at once and must not cancel
  // each other; only a re-request for that same anchor (e.g. re-render)
  // should supersede.
  'symbols.line': (input) =>
    withLatestWins(
      `symbols.line:${input.projectId}:${input.path}:${input.line}`,
      async ({ token }) => {
        const session = requireSession(input.projectId)
        const symbols = await session.lineSymbols(input.path, input.line, token)
        return { path: input.path, line: input.line, symbols }
      }
    ),

  // Keyed by the exact symbol position, not just path: a single anchor line
  // can hold several symbols, each with its own concurrent `symbols.definition`
  // call (one per row in "Symbol definition") that must not cancel the others.
  'symbols.definition': (input) =>
    withLatestWins(
      `symbols.definition:${input.projectId}:${input.path}:${input.pos.line}:${input.pos.col}`,
      async ({ token }) => {
        const session = requireSession(input.projectId)
        const repoRoot = projectRepoDir(input.projectId)
        let symbol = ''
        try {
          const text = await readFile(path.join(repoRoot, input.path), 'utf8')
          const lineText = text.split('\n')[input.pos.line - 1] ?? ''
          symbol = identifierAt(lineText, input.pos.col)
        } catch {
          symbol = ''
        }
        const definitions = await session.definition(input.path, input.pos, token)
        return { symbol, definitions }
      }
    ),

  // Only the side panel's fuzzy prefill calls this (a single box, one query
  // at a time), so latest-wins per (projectId, channel) has no other slot to
  // collide with.
  'symbols.workspace': (input) =>
    withLatestWins(`symbols.workspace:${input.projectId}`, async ({ token }) => {
      const session = requireSession(input.projectId)
      return session.workspaceSymbols(input.query, input.limit ?? 50, token)
    })
}
