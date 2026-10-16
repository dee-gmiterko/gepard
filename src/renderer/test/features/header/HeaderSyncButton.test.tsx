import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../../../src/App';
import { renderWithProviders } from '../../support/render';
import { createWorld, pr } from '../../support/world';

describe('header refresh button', () => {
  it('is hidden without a targeted pull request', async () => {
    const world = createWorld();
    renderWithProviders(<App />, world.handlers);
    await screen.findByPlaceholderText('PR…');

    expect(screen.queryByRole('button', { name: /^Refresh/ })).toBeNull();
  });

  it('shows the number of items to sync in a badge', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    world.handlers['sync.pendingCount'] = () => 3;
    renderWithProviders(<App />, world.handlers);

    await screen.findByRole('button', { name: 'Refresh (3 to sync)' });
    expect(screen.getByText('3')).toBeVisible();
  });

  it('caps the badge at 99+ while keeping the real count in the label', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    world.handlers['sync.pendingCount'] = () => 150;
    renderWithProviders(<App />, world.handlers);

    await screen.findByRole('button', { name: 'Refresh (150 to sync)' });
    expect(screen.getByText('99+')).toBeVisible();
  });

  it('shows no badge when nothing is waiting to sync', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    renderWithProviders(<App />, world.handlers);

    await screen.findByRole('button', { name: 'Refresh' });
    expect(screen.queryByText('0')).toBeNull();
  });

  it('runs a full sync like the file controls button', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    const { user, ipc } = renderWithProviders(<App />, world.handlers);

    await user.click(await screen.findByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(ipc.callsTo('sync.run').at(-1)).toMatchObject({ mode: 'full' }));
  });
});
