import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import type { DiffRow, ReviewThread } from '@gepard/common';
import App from '../../../../../src/App';
import { settle } from '../../../../support/options';
import { renderWithProviders, type Rendered } from '../../../../support/render';
import { createWorld, fileThread, HEAD, pr } from '../../../../support/world';

const lines = ['keep1', 'keep2', 'keep3', 'keep4', 'keep5', 'keep6'];

const rows: DiffRow[] = [
  { kind: 'context', oldLine: 1, newLine: 1, text: 'keep1' },
  { kind: 'delete', oldLine: 2, newLine: null, text: 'gone1' },
  { kind: 'delete', oldLine: 3, newLine: null, text: 'gone2' },
  { kind: 'delete', oldLine: 4, newLine: null, text: 'gone3' },
  { kind: 'context', oldLine: 5, newLine: 2, text: 'keep2' },
  { kind: 'context', oldLine: 6, newLine: 3, text: 'keep3' },
  { kind: 'context', oldLine: 7, newLine: 4, text: 'keep4' },
  { kind: 'context', oldLine: 8, newLine: 5, text: 'keep5' },
  { kind: 'context', oldLine: 9, newLine: 6, text: 'keep6' },
];

function thread(id: string, line: number, side: 'LEFT' | 'RIGHT', body: string): ReviewThread {
  const base = fileThread(id, 'a.ts', line, body, side);
  return { ...base, anchor: { ...base.anchor, commitOid: HEAD } };
}

function renderFullFileDiff(): Rendered {
  const world = createWorld({
    targeting: { pr: 7 },
    layout: { fullFileDiff: true },
    prs: [pr(7, 'Rework a.ts')],
    files: { 'a.ts': lines.join('\n') + '\n' },
    diffRows: { 'a.ts': rows },
    threads: [
      thread('T-left', 3, 'LEFT', 'why was this removed'),
      thread('T-right', 6, 'RIGHT', 'last line looks off'),
    ],
  });
  return renderWithProviders(<App />, world.handlers);
}

async function openThreadInFile(rendered: Rendered, body: string): Promise<EditorView> {
  const { user } = rendered;
  await user.click(await screen.findByRole('tab', { name: 'Comments' }));
  const text = await screen.findByText(body);
  let card: HTMLElement | null = text;
  while (card && !card.querySelector('[aria-label="Open in file"]')) card = card.parentElement;
  const open = card?.querySelector<HTMLElement>('[aria-label="Open in file"]');
  if (!open) throw new Error('open in file button missing');
  await user.click(open);
  return waitFor(() => {
    const dom = document.querySelector<HTMLElement>('.cm-editor');
    const view = dom ? EditorView.findFromDOM(dom) : null;
    if (!view || view.state.doc.toString().trim() !== lines.join('\n')) {
      throw new Error('editor not showing a.ts yet');
    }
    return view;
  });
}

function cursorLine(view: EditorView): number {
  return view.state.doc.lineAt(view.state.selection.main.head).number;
}

describe('revealing a comment in the full-file diff', () => {
  it('moves the cursor to the line of a RIGHT-side comment', async () => {
    const rendered = renderFullFileDiff();
    const view = await openThreadInFile(rendered, 'last line looks off');

    await waitFor(() => expect(cursorLine(view)).toBe(6));
  });

  it('moves the cursor next to the deleted lines for a LEFT-side comment', async () => {
    const rendered = renderFullFileDiff();
    const view = await openThreadInFile(rendered, 'why was this removed');

    await settle(200);
    expect(cursorLine(view)).toBeLessThanOrEqual(2);
  });
});
