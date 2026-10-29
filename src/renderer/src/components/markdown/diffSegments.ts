import type { DiffRow } from '@gepard/common';

export interface MarkdownSegment {
  kind: 'context' | 'add' | 'delete';
  text: string;
  key: string;
}

export function markdownDiffSegments(rows: readonly DiffRow[]): MarkdownSegment[] {
  const segments: { kind: MarkdownSegment['kind']; lines: string[]; key: string }[] = [];
  let open = false;

  for (const row of rows) {
    if (row.kind === 'hunk') {
      open = false;
      continue;
    }
    const last = segments.at(-1);
    if (open && last?.kind === row.kind) {
      last.lines.push(row.text);
    } else {
      segments.push({
        kind: row.kind,
        lines: [row.text],
        key: `${row.kind}:${row.oldLine ?? ''}:${row.newLine ?? ''}`,
      });
      open = true;
    }
  }
  return segments.map(({ kind, lines, key }) => ({ kind, key, text: lines.join('\n') }));
}
