import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandlerMap } from '../registry';
import { AppError } from '../registry';
import { withLatestWins } from '../cancellation';
import { ripgrepSearch, ripgrepSearchPage } from '../../helpers/process/ripgrep';
import {
  applyPage,
  EMPTY_PAGE,
  type Page,
  type PageOptions,
  type PageSourceFile,
} from '../../helpers/search/paging';
import { identifierAt } from '../../helpers/string';
import { indexer } from '../../lsp';
import {
  type LanguageSession,
  type WorkspaceSymbol,
  navigationSymbols,
  makeTargetMatcher,
  type ChannelParsedInput,
  type GroupedResult,
} from '@gepard/common';
import { projectRepoDir } from '../../paths';

const UNPAGED_MAX_MATCHES = 500;
const DEFAULT_MAX_MATCHES_PER_FILE = 50;
const KIND_FILTER_POOL_FACTOR = 10;

function staleShaError(requested: string, current: string): AppError {
  return new AppError(
    'STALE_SHA',
    `Requested sha ${requested} does not match the checked-out head ${current}; the project was checked out to a different target since this request was made`,
  );
}

function requireCurrentSha(projectId: string, sha: string): void {
  const current = indexer.currentSha(projectId);
  if (current !== null && current !== sha) {
    throw staleShaError(sha, current);
  }
}

function findSession(projectId: string, filePath: string): LanguageSession | null {
  return indexer.session(projectId, filePath);
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

type ParsedSearch = ChannelParsedInput<'search.run'>;

function pageOptions(input: ParsedSearch): PageOptions {
  const paged = input.limit !== undefined;
  return {
    offset: input.offset,
    limit: input.limit,
    maxMatchesPerFile:
      input.maxMatchesPerFile ?? (paged ? DEFAULT_MAX_MATCHES_PER_FILE : undefined),
    maxTotalMatches: paged ? undefined : UNPAGED_MAX_MATCHES,
  };
}

function toResult(input: ParsedSearch, page: Page): GroupedResult {
  return {
    query: { kind: input.kind, text: input.text, scope: input.scope },
    files: page.files,
    offset: input.offset,
    nextOffset: page.hasMore ? input.offset + page.files.length : null,
    hasMore: page.hasMore,
    truncated: page.truncated,
    matchesInPage: page.files.reduce((n, f) => n + f.matches.length, 0),
  };
}

export const searchHandlers: Pick<
  HandlerMap,
  'search.run' | 'symbols.line' | 'symbols.definition' | 'symbols.workspace' | 'symbols.document'
> = {
  'search.run': (input) =>
    withLatestWins(searchRunKey(input), async ({ signal, token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const repoRoot = projectRepoDir(input.projectId);
      const opts = pageOptions(input);
      const targeted = input.scope === 'targeted';
      const inScope = targeted ? makeTargetMatcher(input.targetedPaths) : null;
      const scoped = <T extends { path: string }>(files: T[]): T[] =>
        inScope ? files.filter((f) => inScope(f.path)) : files;

      if (input.kind === 'references') {
        const session = findSession(input.projectId, input.at.path);
        const raw = session ? await session.references(input.at.path, input.at.pos, token) : [];
        return toResult(input, applyPage(scoped(raw), opts));
      }

      if (targeted && input.targetedPaths.length === 0) return toResult(input, EMPTY_PAGE);
      const paths = targeted ? input.targetedPaths : undefined;

      if (input.kind === 'pattern' || input.kind === 'regex') {
        // The word index only knows exact spellings, so it can answer case-sensitive lookups alone.
        const lineIndex =
          input.kind === 'pattern' && input.word && input.caseSensitive
            ? indexer.lineIndex(input.projectId)
            : null;
        if (input.kind === 'pattern' && lineIndex && /^[A-Za-z0-9_]+$/.test(input.text)) {
          const hits = await lineIndex.queryWord(input.text);
          return toResult(input, applyPage(scoped(hits), opts));
        }
        const page = await ripgrepSearchPage({
          cwd: repoRoot,
          pattern: input.text,
          fixedString: input.kind === 'pattern',
          word: input.kind === 'pattern' ? input.word : undefined,
          caseSensitive: input.caseSensitive,
          paths,
          signal,
          ...opts,
        });
        return toResult(input, {
          ...page,
          files: page.files.map((f) => ({ ...f, moreMatches: f.moreMatches ?? false })),
        });
      }

      const trimmed = input.text.trim();
      const lineIndex = indexer.lineIndex(input.projectId);
      if (lineIndex) {
        const hits = await lineIndex.queryExactLine(trimmed, input.origin);
        return toResult(input, applyPage(scoped(hits), opts));
      }
      const all = await ripgrepSearch({
        cwd: repoRoot,
        pattern: trimmed,
        fixedString: true,
        paths,
        signal,
      });
      const exact: PageSourceFile[] = all
        .map((f) => ({
          path: f.path,
          matches: f.matches.filter(
            (m) =>
              m.preview.trim() === trimmed &&
              !(f.path === input.origin.path && m.line === input.origin.line),
          ),
        }))
        .filter((f) => f.matches.length > 0);
      return toResult(input, applyPage(exact, opts));
    }),

  'symbols.line': (input) =>
    withLatestWins(
      `symbols.line:${input.projectId}:${input.path}:${input.line}`,
      async ({ token }) => {
        requireCurrentSha(input.projectId, input.sha);
        const session = findSession(input.projectId, input.path);
        const symbols = session ? await session.lineSymbols(input.path, input.line, token) : [];
        return { path: input.path, line: input.line, symbols };
      },
    ),

  'symbols.definition': (input) =>
    withLatestWins(
      `symbols.definition:${input.projectId}:${input.path}:${input.pos.line}:${input.pos.col}`,
      async ({ token }) => {
        requireCurrentSha(input.projectId, input.sha);
        const session = findSession(input.projectId, input.path);
        const repoRoot = projectRepoDir(input.projectId);
        let symbol = '';
        try {
          const text = await readFile(join(repoRoot, input.path), 'utf8');
          const lineText = text.split('\n')[input.pos.line - 1] ?? '';
          symbol = identifierAt(lineText, input.pos.col);
        } catch {
          symbol = '';
        }
        const definitions = session ? await session.definition(input.path, input.pos, token) : [];
        return { symbol, definitions };
      },
    ),

  'symbols.workspace': (input) =>
    withLatestWins(`symbols.workspace:${input.projectId}`, async ({ token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const sessions = indexer.sessions(input.projectId);
      if (sessions.length === 0) return [];
      const limit = input.limit ?? 50;
      const kinds = input.kinds ? new Set(input.kinds) : null;
      // Sessions cap their own results before the kind filter runs, so ask them for a wider pool.
      const sessionLimit = kinds ? Math.max(limit * KIND_FILTER_POOL_FACTOR, limit) : limit;
      const settled = await Promise.allSettled(
        sessions.map((session) => session.workspaceSymbols(input.query, sessionLimit, token)),
      );
      const fulfilled = settled.filter(
        (r): r is PromiseFulfilledResult<WorkspaceSymbol[]> => r.status === 'fulfilled',
      );
      if (fulfilled.length === 0 && settled.length > 0)
        throw (settled[0] as PromiseRejectedResult).reason;
      const merged = fulfilled.flatMap((r) => r.value);
      return (kinds ? merged.filter((s) => kinds.has(s.kind)) : merged).slice(0, limit);
    }),

  'symbols.document': (input) =>
    withLatestWins(`symbols.document:${input.projectId}:${input.path}`, async ({ token }) => {
      requireCurrentSha(input.projectId, input.sha);
      const session = findSession(input.projectId, input.path);
      const symbols = session
        ? navigationSymbols(await session.documentSymbols(input.path, token))
        : [];
      return { path: input.path, symbols };
    }),
};
