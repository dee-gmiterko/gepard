import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../../../src/App';
import { renderWithProviders, type Rendered } from '../../support/render';
import { comment, createWorld } from '../../support/world';

function renderComments(): Rendered {
  const world = createWorld();
  return renderWithProviders(<App />, {
    ...world.handlers,
    'comments.upsert': (draft) => comment('C1', 'T1', draft.body),
  });
}

describe('pull request comment composer', () => {
  it('submits the general comment with ctrl+enter', async () => {
    const { user, ipc } = renderComments();

    await user.click(await screen.findByRole('tab', { name: 'Comments' }));
    await user.type(await screen.findByPlaceholderText('Leave a general comment…'), 'overall ok');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(ipc.callsTo('comments.upsert')).toHaveLength(1));
    expect(ipc.callsTo('comments.upsert')[0]).toMatchObject({ general: true, body: 'overall ok' });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Leave a general comment…')).toHaveValue(''),
    );
  });

  it('keeps a plain enter as a line break', async () => {
    const { user, ipc } = renderComments();

    await user.click(await screen.findByRole('tab', { name: 'Comments' }));
    await user.type(await screen.findByPlaceholderText('Leave a general comment…'), 'a{Enter}b');

    expect(screen.getByPlaceholderText('Leave a general comment…')).toHaveValue('a\nb');
    expect(ipc.callsTo('comments.upsert')).toHaveLength(0);
  });

  it('submits the trimmed comment with the Comment button and clears the field', async () => {
    const { user, ipc } = renderComments();

    await user.click(await screen.findByRole('tab', { name: 'Comments' }));
    const field = await screen.findByPlaceholderText('Leave a general comment…');
    await user.type(field, '  looks good  ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(ipc.callsTo('comments.upsert')).toHaveLength(1));
    expect(ipc.callsTo('comments.upsert')[0]).toMatchObject({
      id: null,
      threadId: null,
      anchor: null,
      general: true,
      body: 'looks good',
      references: [],
    });
    await waitFor(() => expect(field).toHaveValue(''));
  });

  it('disables the Comment button while the field is blank', async () => {
    const { user } = renderComments();

    await user.click(await screen.findByRole('tab', { name: 'Comments' }));
    const field = await screen.findByPlaceholderText('Leave a general comment…');
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();

    await user.type(field, '   ');
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();

    await user.type(field, 'x');
    expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled();
  });

  it('does not submit a blank comment with ctrl+enter', async () => {
    const { user, ipc } = renderComments();

    await user.click(await screen.findByRole('tab', { name: 'Comments' }));
    await user.type(await screen.findByPlaceholderText('Leave a general comment…'), '  ');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(ipc.callsTo('comments.upsert')).toHaveLength(0);
  });
});
