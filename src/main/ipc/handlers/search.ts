import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandlerMap } from '../registry';
import { AppError } from '../registry';
import { withLatestWins } from '../cancellation';
import { ripgrepSearch, type RipgrepFileResult } from '../../helpers/process/ripgrep';
import { identifierAt } from '../../helpers/string';
import { indexer } from '../../lsp';
import type { LanguageSession } from '../../lsp/session';
import { projectRepoDir } from '../../paths';
import { isTargeted } from '@shared/model/paths';

function staleShaError(requested: string, current: string): Error {
  const err = new Error(
    `Requested sha ${requested} does not match the checked-out head ${current}; the project was checked out to a different target since this request was made`,
  );
  err.name = 'AbortError';
  return err;
}

function requireCurrentSha(projectId: string, sha: string): void {
  const current = indexer.currentSha(projectId);
  if (current !== null && current !== sha) {
    throw staleShaError(sha, current);
  }
}

function requireSession(projectId: string): LanguageSession {
  const session = indexer.session(projectId);
  if (!session) {
    throw new AppError(
      'NO_LANGUAGE_SESSION',
      'No language session is available for this project (still indexing, or no LSP extension matched any file)',
    );
  }
  return session;
}

export function searchRunKey(input: {
  projectId: string;
  scope: 'all' | 'targeted';
  text: string;
  kind: 'pattern' | 'regex' | 'exactLine' | 'references';
  word?: boolean;
  origin?: { path: string; line: number };
  at?: { path: string; pos: { line: number; col: number } };
}): string {
  const base = `search.run:${input.projectId}:${input.kind}`;
  if (input.kind === 'pattern')
    return input.word ? `${base}:word:${input.scope}:${input.text}` : base;
  if (input.kind === 'exactLine') return `${base}:${input.origin!.path}:${input.origin!.line}`;
  if (input.kind === 'references')
    return `${base}:${input.at!.path}:${input.at!.pos.line}:${input.at!.pos.col}`;
  return base;
}

export const searchHandlers: Pick<
  HandlerMap,
  'search.run' | 'symbols.line' | 'symbols.definition' | 'symbols.workspace' | 'symbols.document'
> = {
  'search.run': (input) =>
    withLatestWins(searchRunKey(input), async ({ signal, token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const repoRoot = projectRepoDir(input.projectId);
      const targetedPaths = input.targetedPaths;

      if (input.kind === 'references') {
        const session = requireSession(input.projectId);
        const raw = await session.references(input.at.path, input.at.pos, token);
        const scoped =
          input.scope === 'targeted' ? raw.filter((f) => isTargeted(f.path, targetedPaths)) : raw;
        const files = scoped.map((f) => ({ ...f, targeted: isTargeted(f.path, targetedPaths) }));
        return {
          query: { kind: 'references' as const, text: input.text, scope: input.scope },
          files,
          totalMatches: files.reduce((n, f) => n + f.matches.length, 0),
        };
      }

      if (input.scope === 'targeted' && targetedPaths.length === 0) {
        return {
          query: { kind: input.kind, text: input.text, scope: input.scope },
          files: [],
          totalMatches: 0,
        };
      }

      let rgResults: RipgrepFileResult[];
      if (input.kind === 'pattern') {
        const lineIndex = input.word ? indexer.lineIndex(input.projectId) : null;
        if (lineIndex && /^[A-Za-z0-9_]+$/.test(input.text)) {
          const hits = await lineIndex.queryWord(input.text);
          rgResults =
            input.scope === 'targeted'
              ? hits.filter((f) => isTargeted(f.path, targetedPaths))
              : hits;
        } else {
          rgResults = await ripgrepSearch({
            cwd: repoRoot,
            pattern: input.text,
            fixedString: true,
            word: input.word,
            paths: input.scope === 'targeted' ? targetedPaths : undefined,
            signal,
          });
        }
      } else if (input.kind === 'regex') {
        rgResults = await ripgrepSearch({
          cwd: repoRoot,
          pattern: input.text,
          fixedString: false,
          paths: input.scope === 'targeted' ? targetedPaths : undefined,
          signal,
        });
      } else {
        const trimmed = input.text.trim();
        const lineIndex = indexer.lineIndex(input.projectId);
        if (lineIndex) {
          const hits = await lineIndex.queryExactLine(trimmed, input.origin);
          rgResults =
            input.scope === 'targeted'
              ? hits.filter((f) => isTargeted(f.path, targetedPaths))
              : hits;
        } else {
          const all = await ripgrepSearch({
            cwd: repoRoot,
            pattern: trimmed,
            fixedString: true,
            paths: input.scope === 'targeted' ? targetedPaths : undefined,
            signal,
          });
          rgResults = all
            .map((f) => ({
              path: f.path,
              matches: f.matches.filter(
                (m) =>
                  m.preview.trim() === trimmed &&
                  !(f.path === input.origin.path && m.line === input.origin.line),
              ),
            }))
            .filter((f) => f.matches.length > 0);
        }
      }

      const files = rgResults.map((f) => ({
        path: f.path,
        targeted: isTargeted(f.path, targetedPaths),
        matches: f.matches,
      }));
      return {
        query: { kind: input.kind, text: input.text, scope: input.scope },
        files,
        totalMatches: files.reduce((n, f) => n + f.matches.length, 0),
      };
    }),

  'symbols.line': (input) =>
    withLatestWins(
      `symbols.line:${input.projectId}:${input.path}:${input.line}`,
      async ({ token }) => {
        requireCurrentSha(input.projectId, input.sha);
        const session = requireSession(input.projectId);
        const symbols = await session.lineSymbols(input.path, input.line, token);
        return { path: input.path, line: input.line, symbols };
      },
    ),

  'symbols.definition': (input) =>
    withLatestWins(
      `symbols.definition:${input.projectId}:${input.path}:${input.pos.line}:${input.pos.col}`,
      async ({ token }) => {
        requireCurrentSha(input.projectId, input.sha);
        const session = requireSession(input.projectId);
        const repoRoot = projectRepoDir(input.projectId);
        let symbol = '';
        try {
          const text = await readFile(join(repoRoot, input.path), 'utf8');
          const lineText = text.split('\n')[input.pos.line - 1] ?? '';
          symbol = identifierAt(lineText, input.pos.col);
        } catch {
          symbol = '';
        }
        const definitions = await session.definition(input.path, input.pos, token);
        return { symbol, definitions };
      },
    ),

  'symbols.workspace': (input) =>
    withLatestWins(`symbols.workspace:${input.projectId}`, async ({ token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const session = requireSession(input.projectId);
      return session.workspaceSymbols(input.query, input.limit ?? 50, token);
    }),

  'symbols.document': (input) =>
    withLatestWins(`symbols.document:${input.projectId}:${input.path}`, async ({ token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const session = requireSession(input.projectId);
      const symbols = await session.documentSymbols(input.path, token);
      return { path: input.path, symbols };
    }),
};
