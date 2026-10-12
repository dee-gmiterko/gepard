import { IpcError } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import App from '../../../src/App';
import { renderWithProviders } from '../../support/render';
import { createWorld, pr } from '../../support/world';

describe('offline indicator', () => {
  it('shows the warning when the main process reports a connection loss and hides it when it clears', async () => {
    const world = createWorld();
    const { ipc } = renderWithProviders(<App />, world.handlers);
    await screen.findByPlaceholderText('PR…');
    expect(screen.queryByText('Offline')).toBeNull();

    act(() => ipc.emit('connectivity.changed', { offline: true }));
    const indicator = await screen.findByRole('status', { name: /GitHub could not be reached/ });
    expect(indicator).toHaveTextContent('Offline');

    act(() => ipc.emit('connectivity.changed', { offline: false }));
    await waitFor(() => expect(screen.queryByText('Offline')).toBeNull());
  });

  it('starts in the offline state the main process already knows about', async () => {
    const world = createWorld();
    world.handlers['connectivity.get'] = () => ({ offline: true });
    renderWithProviders(<App />, world.handlers);

    expect(await screen.findByText('Offline')).toBeVisible();
  });

  it('shows the dedicated toast when a sync fails because of the connection', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    const pullSync = world.handlers['sync.run'];
    if (!pullSync) throw new Error('world has no sync handler');
    world.handlers['sync.run'] = (input) => {
      if (input.mode !== 'full') return pullSync(input);
      throw new IpcError(
        { code: 'CONNECTION_FAILED', message: 'gh exited with code 1: Could not resolve host' },
        'sync.run',
      );
    };
    const { user } = renderWithProviders(<App />, world.handlers);

    await user.click(await screen.findByRole('button', { name: 'Sync' }));

    const toast = await screen.findByText(
      'GitHub could not be reached. Check your connection and try again.',
    );
    expect(toast).toBeVisible();
  });
});
