import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import App from '../../../src/App';
import { fileDetailsPanel, renderWithProviders, type Rendered } from '../../support/render';
import { createWorld, fileThread } from '../../support/world';

function renderPanel(threads = [fileThread('T1', 'a.ts', 1, 'comment on a')]): Rendered {
  const world = createWorld({ layout: { fileCommentsPanelOpen: true }, threads });
  return renderWithProviders(<App />, world.handlers);
}

async function openFile(rendered: Rendered, name: string): Promise<void> {
  await rendered.user.click(await screen.findByText(name));
}

describe('file comments panel', () => {
  it('lists the comments of the active file only', async () => {
    const rendered = renderPanel([
      fileThread('T1', 'a.ts', 1, 'comment on a'),
      fileThread('T2', 'b.ts', 1, 'comment on b'),
    ]);
    await openFile(rendered, 'a.ts');

    const panel = within(await waitFor(() => fileDetailsPanel()));
    expect(await panel.findByText('comment on a')).toBeInTheDocument();
    expect(panel.queryByText('comment on b')).not.toBeInTheDocument();
  });

  it('shows an empty state for a file without comments', async () => {
    const rendered = renderPanel([]);
    await openFile(rendered, 'a.ts');

    expect(await within(fileDetailsPanel()).findByText('No comments on this file.')).toBeVisible();
  });

  it('submits a new file comment anchored on the active file', async () => {
    const rendered = renderPanel([]);
    const { user, ipc } = rendered;
    await openFile(rendered, 'a.ts');

    const panel = within(fileDetailsPanel());
    await user.click(await panel.findByRole('button', { name: 'New file comment' }));
    await user.type(panel.getByPlaceholderText('Leave a comment…'), 'needs a rename');
    await user.click(panel.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(ipc.callsTo('comments.upsert')).toHaveLength(1));
    expect(ipc.callsTo('comments.upsert')[0]).toMatchObject({
      body: 'needs a rename',
      anchor: { path: 'a.ts', subjectType: 'FILE', line: null },
    });
    expect(await panel.findByText('needs a rename')).toBeInTheDocument();
  });

  it('edits a comment in place', async () => {
    const rendered = renderPanel();
    const { user, ipc } = rendered;
    await openFile(rendered, 'a.ts');

    const panel = within(fileDetailsPanel());
    await user.click(await panel.findByRole('button', { name: /comment on a/ }));
    await user.click(await panel.findByRole('button', { name: 'Edit comment' }));
    const editor = panel.getByDisplayValue('comment on a');
    await user.clear(editor);
    await user.type(editor, 'reworded');
    await user.click(panel.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(ipc.callsTo('comments.upsert')).toHaveLength(1));
    expect(ipc.callsTo('comments.upsert')[0]).toMatchObject({
      id: 'T1-c1',
      threadId: 'T1',
      body: 'reworded',
    });
    await waitFor(() => expect(panel.getAllByText('reworded').length).toBeGreaterThan(0));
    expect(panel.queryByText('comment on a')).not.toBeInTheDocument();
  });

  it('deletes a comment after confirmation', async () => {
    const rendered = renderPanel();
    const { user, ipc } = rendered;
    await openFile(rendered, 'a.ts');

    const panel = within(fileDetailsPanel());
    await user.click(await panel.findByRole('button', { name: /comment on a/ }));
    await user.click(await panel.findByRole('button', { name: 'Delete comment' }));
    expect(panel.getByText('Delete this comment?')).toBeVisible();
    await user.click(panel.getByRole('button', { name: 'Delete comment' }));

    await waitFor(() => expect(ipc.callsTo('comments.delete')).toHaveLength(1));
    expect(ipc.callsTo('comments.delete')[0]).toMatchObject({ commentId: 'T1-c1' });
    await waitFor(() =>
      expect(within(fileDetailsPanel()).queryByText('comment on a')).not.toBeInTheDocument(),
    );
  });

  it('does not carry a draft file comment over to another file', async () => {
    const rendered = renderPanel([]);
    const { user } = rendered;
    await openFile(rendered, 'a.ts');

    let panel = within(fileDetailsPanel());
    await panel.findByTitle('a.ts');
    await user.click(await panel.findByRole('button', { name: 'New file comment' }));
    await user.type(panel.getByPlaceholderText('Leave a comment…'), 'draft for a');

    await openFile(rendered, 'b.ts');

    panel = within(fileDetailsPanel());
    await panel.findByTitle('b.ts');
    expect(panel.queryByDisplayValue('draft for a')).not.toBeInTheDocument();
  });
});
