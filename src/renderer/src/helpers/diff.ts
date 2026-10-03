import type { DiffRow, DiffSide, LineSymbol } from '@gepard/common';
import { escapeRegExp } from './string';

export function findDiffDocLine(
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  line: number,
  side: DiffSide,
): number | null {
  const key = side === 'LEFT' ? 'oldLine' : 'newLine';
  const i = infos.findIndex((info) => info[key] === line);
  return i === -1 ? null : i + 1;
}

export type ChangeRow = Pick<DiffRow, 'kind' | 'oldLine' | 'newLine' | 'text'>;
type NamedSymbol = Pick<LineSymbol, 'name' | 'kind'>;

const KEPT_KINDS: ReadonlySet<string> = new Set(['function', 'method']);

export function changedRows(rows: readonly ChangeRow[]): ChangeRow[] {
  return rows.filter((r) => r.kind === 'add' || r.kind === 'delete');
}

export function changeLines(rows: readonly ChangeRow[]): string[] {
  return changedRows(rows).map((r) => `${r.kind === 'add' ? '+' : '-'}${r.text.trim()}`);
}

export function changeSignature(lines: readonly string[]): string {
  return lines.join('\n');
}

export function similarMatcher(
  lines: readonly string[],
  symbolsPerLine: readonly (readonly NamedSymbol[])[],
): RegExp | null {
  const names = new Set<string>();
  for (const symbols of symbolsPerLine) {
    for (const s of symbols) {
      if (!KEPT_KINDS.has(s.kind) && /^\w+$/.test(s.name)) names.add(s.name);
    }
  }
  if (names.size === 0) return null;
  const alternation = [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const token = new RegExp(`(?<!\\w)(?:${alternation})(?!\\w)`, 'g');
  const groups = new Map<string, number>();
  const parts = lines.map((line, i) => {
    const present = new Set(
      symbolsPerLine[i]?.filter((s) => !KEPT_KINDS.has(s.kind)).map((s) => s.name),
    );
    let out = '';
    let last = 0;
    for (const m of line.matchAll(token)) {
      if (!present.has(m[0])) continue;
      const group = groups.get(m[0]);
      if (group === undefined) groups.set(m[0], groups.size + 1);
      out +=
        escapeRegExp(line.slice(last, m.index)) +
        (group === undefined ? '(\\w+)' : `(?:\\${group})`);
      last = m.index + m[0].length;
    }
    return out + escapeRegExp(line.slice(last));
  });
  return groups.size === 0 ? null : new RegExp(`^${parts.join('\n')}$`);
}

export function matchesSimilar(matcher: RegExp, lines: readonly string[]): boolean {
  return matcher.test(changeSignature(lines));
}
