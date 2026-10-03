import type { GroupedResult, LineSymbol } from '@gepard/common';

export interface LinePattern {
  id: string;
  display: string;
  regex: string;
}

type PatternSymbol = Pick<LineSymbol, 'name' | 'kind'> & { range?: LineSymbol['range'] };

const KEPT_KINDS: ReadonlySet<string> = new Set(['function', 'method']);

export function escapeRegex(text: string): string {
  return text.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&');
}

function isWord(text: string): boolean {
  return /^\w+$/.test(text);
}

function replaceOccurrences(text: string, name: string): string {
  const occurrence = new RegExp(`(?<!\\w)${escapeRegex(name)}(?!\\w)`, 'g');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(occurrence)) {
    out += escapeRegex(text.slice(last, m.index)) + '\\w+';
    last = m.index + name.length;
  }
  return out + escapeRegex(text.slice(last));
}

function symbolEnd(raw: string, symbol: PatternSymbol): number {
  const at = symbol.range ? symbol.range.start.col - 1 : -1;
  if (at >= 0 && raw.startsWith(symbol.name, at)) return at + symbol.name.length;
  const found = raw.indexOf(symbol.name);
  return found === -1 ? -1 : found + symbol.name.length;
}

export function buildLinePatterns(
  rawLine: string,
  symbols: readonly PatternSymbol[],
): LinePattern[] {
  const text = rawLine.trim();
  if (!text) return [];
  const indent = rawLine.length - rawLine.trimStart().length;
  const patterns = new Map<string, LinePattern>();
  const add = (display: string, regex: string): void => {
    if (!patterns.has(regex)) patterns.set(regex, { id: regex, display, regex });
  };

  const replaced = new Set<string>();
  for (const s of symbols) {
    if (KEPT_KINDS.has(s.kind) || !isWord(s.name) || replaced.has(s.name)) continue;
    replaced.add(s.name);
    const body = replaceOccurrences(text, s.name);
    if (body === escapeRegex(text)) continue;
    add(body, `^\\s*${body}\\s*$`);
  }

  for (const s of symbols) {
    if (!isWord(s.name)) continue;
    const end = symbolEnd(rawLine, s) - indent;
    if (end <= 0 || end > text.length) continue;
    const prefix = text.slice(0, end);
    add(prefix, `^\\s*${escapeRegex(prefix)}\\b.*`);
  }
  return [...patterns.values()];
}

export function withoutExactMatches(
  data: GroupedResult,
  lineText: string,
  origin: { path: string; line: number },
): GroupedResult {
  const exact = lineText.trim();
  const files = data.files
    .map((f) => ({
      ...f,
      matches: f.matches.filter(
        (m) => m.preview.trim() !== exact && !(f.path === origin.path && m.line === origin.line),
      ),
    }))
    .filter((f) => f.matches.length > 0);
  return { ...data, files };
}
