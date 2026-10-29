import { z } from 'zod';
import type { DiffRow } from '@gepard/common';

export const MarkdownViewType = z.enum(['file', 'diff']);
export type MarkdownViewType = z.infer<typeof MarkdownViewType>;

const MARKDOWN_PATH = /\.(?:md|markdown|mkd)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_PATH.test(path);
}

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
