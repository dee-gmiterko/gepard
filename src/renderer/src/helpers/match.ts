import { fuzzyMatch } from './fuzzy';

export interface TextMatch {
  from: number;
  to: number;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

// Case folding that keeps offsets aligned with the original text; a few scripts lower-case to a
// different length, in which case the text is matched case-sensitively instead.
export function foldCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.length === text.length ? lower : text;
}

function occurrences(haystack: string, needle: string): number[] {
  const out: number[] = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    out.push(at);
  }
  return out;
}

function fuzzyLineMatch(text: string, query: string): TextMatch | null {
  let best: { score: number; from: number; to: number } | null = null;
  let lineStart = 0;
  for (const line of text.split('\n')) {
    const match = line.length > 0 ? fuzzyMatch(query, line) : null;
    if (match && (!best || match.score > best.score)) {
      best = {
        score: match.score,
        from: lineStart + match.indices[0],
        to: lineStart + match.indices[match.indices.length - 1] + 1,
      };
    }
    lineStart += line.length + 1;
  }
  return best && { from: best.from, to: best.to };
}

// Exact-case and whole-word occurrences rank first, nearest after the anchor (wrapping) among
// equals; with no occurrence at all, the best fuzzy line match wins.
export function findBestMatch(
  text: string,
  query: string,
  anchor: number,
  folded: string = foldCase(text),
): TextMatch | null {
  if (query.length === 0) return null;
  const needle = folded === text ? query : query.toLowerCase();
  const hits = occurrences(folded, needle);
  if (hits.length === 0) return fuzzyLineMatch(text, query);
  let best: { at: number; score: number; distance: number } | null = null;
  for (const at of hits) {
    let score = 0;
    if (text.startsWith(query, at)) score += 2;
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + needle.length])) score += 1;
    const distance = at >= anchor ? at - anchor : at - anchor + text.length;
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { at, score, distance };
    }
  }
  return best && { from: best.at, to: best.at + needle.length };
}

export function nextMatch(
  text: string,
  query: string,
  current: TextMatch,
  direction: 1 | -1,
  folded: string = foldCase(text),
): TextMatch | null {
  if (query.length === 0) return null;
  const needle = folded === text ? query : query.toLowerCase();
  let at: number;
  if (direction === 1) {
    at = folded.indexOf(needle, current.from + 1);
    if (at === -1) at = folded.indexOf(needle);
  } else {
    at = current.from > 0 ? folded.lastIndexOf(needle, current.from - 1) : -1;
    if (at === -1) at = folded.lastIndexOf(needle);
  }
  return at === -1 ? null : { from: at, to: at + needle.length };
}
