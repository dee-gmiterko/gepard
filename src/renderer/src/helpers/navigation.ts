import { fuzzyMatch, fuzzyRanges } from './fuzzy';
import type { TextRange } from '../components/HighlightedText';
import type { WorkspaceSymbol } from '@gepard/common';

export const QUICK_SEARCH_LIMIT = 8;

export type NavigationMatch =
  | { kind: 'file'; key: string; path: string; line: null; ranges: TextRange[] }
  | {
      kind: 'symbol';
      key: string;
      path: string;
      line: number;
      symbol: WorkspaceSymbol;
      ranges: TextRange[];
    };

interface Scored {
  score: number;
  path: string;
  build: () => NavigationMatch;
}

const BASENAME_BONUS = 20;
const BASENAME_PREFIX_BONUS = 10;
const TARGETED_BONUS = 15;
const SYMBOL_BONUS = 20;
const SYMBOL_EXACT_BONUS = 30;
const SYMBOL_PREFIX_BONUS = 10;

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function scoreFile(
  query: string,
  lowerQuery: string,
  path: string,
  targeted: boolean,
): number | null {
  const match = fuzzyMatch(query, path);
  if (!match) return null;
  let score = match.score;
  const basename = basenameOf(path).toLowerCase();
  if (basename.includes(lowerQuery)) score += BASENAME_BONUS;
  if (basename.startsWith(lowerQuery)) score += BASENAME_PREFIX_BONUS;
  if (targeted) score += TARGETED_BONUS;
  return score - path.length / 100;
}

function scoreSymbol(query: string, lowerQuery: string, symbol: WorkspaceSymbol): number | null {
  const match = fuzzyMatch(query, symbol.name);
  if (!match) return null;
  let score = match.score + SYMBOL_BONUS;
  const name = symbol.name.toLowerCase();
  if (name === lowerQuery) score += SYMBOL_EXACT_BONUS;
  if (name.startsWith(lowerQuery)) score += SYMBOL_PREFIX_BONUS;
  return score;
}

export function rankNavigation(
  query: string,
  files: readonly string[],
  symbols: readonly WorkspaceSymbol[],
  targeted: ReadonlySet<string>,
  limit = QUICK_SEARCH_LIMIT,
): NavigationMatch[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const lowerQuery = trimmed.toLowerCase();
  const scored: Scored[] = [];

  for (const path of files) {
    const score = scoreFile(trimmed, lowerQuery, path, targeted.has(path));
    if (score === null) continue;
    scored.push({
      score,
      path,
      build: () => ({
        kind: 'file',
        key: path,
        path,
        line: null,
        ranges: fuzzyRanges(trimmed, path),
      }),
    });
  }

  const seen = new Set<string>();
  for (const symbol of symbols) {
    const { path, range } = symbol.location;
    const key = `${path}:${range.start.line}:${range.start.col}:${symbol.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const score = scoreSymbol(trimmed, lowerQuery, symbol);
    if (score === null) continue;
    scored.push({
      score,
      path,
      build: () => ({
        kind: 'symbol',
        key,
        path,
        line: range.start.line,
        symbol,
        ranges: fuzzyRanges(trimmed, symbol.name),
      }),
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path),
  );
  return scored.slice(0, limit).map((s) => s.build());
}
