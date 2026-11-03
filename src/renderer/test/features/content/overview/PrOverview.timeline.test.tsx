import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Commit, PrOverviewDetails } from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders } from '../../../support/render';
import { createWorld, pr } from '../../../support/world';

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

function commit(n: number): Commit {
  return {
    oid: n.toString(16).padEnd(40, 'a'),
    messageHeadline: `Change number ${n}`,
    messageBody: '',
    authoredDate: `2026-01-01T10:${String(n).padStart(2, '0')}:00Z`,
    committedDate: `2026-01-01T10:${String(n).padStart(2, '0')}:00Z`,
    authors: [{ login: 'alice', name: 'Alice', email: 'a@example.com' }],
  };
}

describe('PR overview timeline', () => {
  it('collapses long commit runs and expands them in place', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    const commits = Array.from({ length: 12 }, (_, i) => commit(i + 1));
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'overview.pr': () => details,
      'pr.commits': () => commits,
    });

    const timeline = await screen.findByRole('region', { name: 'Timeline' });
    expect(await within(timeline).findByText('Change number 1')).toBeTruthy();
    expect(within(timeline).queryByText('Change number 12')).toBeNull();
    const shown = within(timeline)
      .getAllByText(/^Change number \d+$/)
      .map((el) => el.textContent);
    expect(shown).toEqual(Array.from({ length: 8 }, (_, i) => `Change number ${i + 1}`));

    await user.click(within(timeline).getByRole('button', { name: 'Show 4 more commits' }));

    expect(await within(timeline).findByText('Change number 12')).toBeTruthy();
    expect(within(timeline).queryByRole('button', { name: /more commits/ })).toBeNull();
  });
});
