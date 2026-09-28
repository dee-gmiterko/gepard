export interface FuzzyMatch {
  score: number;
  indices: number[];
}

function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  if (query.length === 0) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let prev = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      score += ti === prev + 1 ? 5 : 1;
      prev = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  score += Math.max(0, 10 - indices[0]);
  return { score, indices };
}

export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (query.trim().length === 0) return [...items];
  const scored: { item: T; match: FuzzyMatch }[] = [];
  for (const item of items) {
    const match = fuzzyMatch(query, getText(item));
    if (match) scored.push({ item, match });
  }
  scored.sort((a, b) => b.match.score - a.match.score);
  return scored.map((s) => s.item);
}

export function fuzzyRanges(query: string, text: string): [number, number][] {
  const match = query ? fuzzyMatch(query, text) : null;
  const ranges: [number, number][] = [];
  for (const i of match?.indices ?? []) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else ranges.push([i, i + 1]);
  }
  return ranges;
}
