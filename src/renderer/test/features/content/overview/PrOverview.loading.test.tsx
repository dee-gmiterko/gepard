import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { PrOverviewDetails } from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders } from '../../../support/render';
import { createWorld, pr } from '../../../support/world';

const details: PrOverviewDetails = {
  state: 'OPEN',
  isDraft: false,
  body: 'Detailed description body',
  updatedAt: '2026-01-01T00:00:00Z',
  mergedAt: null,
  closedAt: null,
  reviewDecision: 'APPROVED',
  reviews: [],
  reviewRequests: ['dave'],
};

describe('PR overview progressive loading', () => {
  it('renders fast parts while the slow details are still scaffolded', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    let release: (value: PrOverviewDetails) => void = () => undefined;
    const slow = new Promise<PrOverviewDetails>((resolve) => {
      release = resolve;
    });
    const handlers = { ...world.handlers, 'overview.pr': () => slow };
    renderWithProviders(<App />, handlers);

    expect(await screen.findByText(/wants to merge feature-7 into main/)).toBeVisible();
    expect(await screen.findByText('File types')).toBeVisible();
    expect(screen.getByText('Description')).toBeVisible();
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('Detailed description body')).toBeNull();

    release(details);

    expect(await screen.findByText('Detailed description body')).toBeVisible();
    expect(screen.getByText('Requested')).toBeVisible();
    await waitFor(() => expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(0));
  });

  it('shows an error instead of a skeleton when the details fail', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    const handlers = {
      ...world.handlers,
      'overview.pr': () => Promise.reject(new Error('boom')),
    };
    renderWithProviders(<App />, handlers);

    const errors = await screen.findAllByText(/Could not load: .*boom/, undefined, {
      timeout: 15_000,
    });
    expect(errors.length).toBeGreaterThan(0);
  }, 20_000);
});
