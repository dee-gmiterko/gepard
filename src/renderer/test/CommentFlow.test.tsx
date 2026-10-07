import { describe, expect, it } from 'vitest';
import { screen, waitFor, within, type BoundFunctions, type queries } from '@testing-library/react';
import App from '../src/App';
import { first } from './support/options';
import { renderWithProviders } from './support/render';
import { createWorld } from './support/world';

function editorScope(): BoundFunctions<typeof queries> {
  const editor = document.querySelector<HTMLElement>('.cm-editor');
  if (!editor) throw new Error('editor is not rendered');
  return within(editor);
}

describe('commenting on a line, end to end', () => {
  it('creates, replies to, edits and deletes a comment from the code view', async () => {
    const world = createWorld({ files: { 'a.ts': 'const a = 1;\nconst b = 2;\n' } });
    const { user, ipc } = renderWithProviders(<App />, world.handlers);

    await user.click(await screen.findByText('a.ts'));
    await waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
    const affordances = await editorScope().findAllByRole('button', {
      name: 'Add comment',
      hidden: true,
    });
    await user.click(first(affordances));

    await user.type(await editorScope().findByPlaceholderText('Leave a comment…'), 'first note');
    await user.click(editorScope().getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(ipc.callsTo('comments.upsert')).toHaveLength(1));
    expect(ipc.callsTo('comments.upsert')[0]).toMatchObject({
      pr: null,
      body: 'first note',
      anchor: { path: 'a.ts', subjectType: 'LINE', side: 'RIGHT', line: 1 },
    });
    expect(await editorScope().findByText('first note')).toBeVisible();

    await user.click(await editorScope().findByRole('button', { name: 'Reply…' }));
    await user.type(editorScope().getByPlaceholderText('Leave a comment…'), 'a reply');
    await user.click(editorScope().getByRole('button', { name: 'Reply' }));
    expect(await editorScope().findByText('a reply')).toBeVisible();
    expect(ipc.callsTo('comments.upsert')[1]).toMatchObject({ threadId: 'T_1', body: 'a reply' });

    await user.click(first(editorScope().getAllByRole('button', { name: 'Edit comment' })));
    const editBox = editorScope().getByDisplayValue('first note');
    await user.clear(editBox);
    await user.type(editBox, 'edited note');
    await user.click(editorScope().getByRole('button', { name: 'Save' }));
    expect(await editorScope().findByText('edited note')).toBeVisible();
    expect(editorScope().queryByText('first note')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(await screen.findByText('edited note')).toBeVisible();
    expect(screen.getByText('a reply')).toBeVisible();

    await user.click(first(screen.getAllByRole('button', { name: 'Delete comment' })));
    const question = await screen.findByText('Delete this comment?');
    const confirmBox = question.closest('div');
    if (!confirmBox) throw new Error('confirmation box not found');
    await user.click(within(confirmBox).getByRole('button', { name: 'Delete comment' }));
    await waitFor(() => expect(screen.queryByText('edited note')).not.toBeInTheDocument());
    expect(screen.getByText('a reply')).toBeVisible();
  });
});
