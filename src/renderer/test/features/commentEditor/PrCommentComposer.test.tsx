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
});
