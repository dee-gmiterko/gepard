import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { PrOverviewDetails } from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders, type Rendered } from '../../../support/render';
import { findOption } from '../../../support/options';
import { createWorld, overviewPr, pr } from '../../../support/world';

const details: PrOverviewDetails = {
  state: 'OPEN',
  isDraft: false,
  body: 'Body',
  updatedAt: '2026-01-01T00:00:00Z',
  mergedAt: null,
  closedAt: null,
  reviewDecision: null,
  mergeReadiness: { state: 'READY', blockers: [], warnings: [] },
  reviews: [],
  reviewRequests: [],
};

function renderApp(targeting: { pr: number | null } = { pr: null }): Rendered {
  const world = createWorld({
    prs: [pr(7, 'Speed up the indexer')],
    searchablePrs: [pr(42, 'Add feature flags')],
    overviewPrs: [overviewPr(7, 'Speed up the indexer')],
    targeting,
  });
  return renderWithProviders(<App />, { ...world.handlers, 'overview.pr': () => details });
}

const heading = (): Promise<HTMLElement> =>
  screen.findByRole('heading', { name: '#7 Speed up the indexer' });

describe('PR overview is independent of the review target', () => {
  it('opens the details of a PR without targeting or persisting anything', async () => {
    const { user, ipc } = renderApp();

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));

    expect(await heading()).toBeVisible();
    expect(await screen.findByPlaceholderText('PR…')).toHaveValue('');
    expect(ipc.callsTo('projects.setTargeting')).toEqual([]);
    expect(ipc.callsTo('pr.checkout').every((c) => c.target.kind === 'default')).toBe(true);
  });

  it('keeps showing the viewed PR after the target changes in the header', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));
    await heading();

    const input = await screen.findByPlaceholderText('PR…');
    await user.type(input, 'flags');
    await user.click(await findOption('#42 Add feature flags'));

    await waitFor(() => expect(input).toHaveValue('#42 Add feature flags'));
    expect(await heading()).toBeVisible();
  });

  it('stays on the viewed PR when the header target is cleared', async () => {
    const { user } = renderApp({ pr: 7 });
    expect(await heading()).toBeVisible();

    const input = await screen.findByPlaceholderText('PR…');
    await user.click(await screen.findByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(input).toHaveValue(''));
    expect(await heading()).toBeVisible();
  });
});
