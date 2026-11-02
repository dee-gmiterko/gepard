import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
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
  it('collapses long commit runs, shows short SHAs and expands in place', async () => {
    const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
    const commits = Array.from({ length: 12 }, (_, i) => commit(i + 1));
    const { user } = renderWithProviders(<App />, {
      ...world.handlers,
      'overview.pr': () => details,
      'pr.commits': () => commits,
    });

    expect(await screen.findByText('Change number 1')).toBeVisible();
    expect(screen.getByText('1aaaaaa')).toBeVisible();
    expect(screen.queryByText('Change number 12')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show 4 more commits' }));

    expect(await screen.findByText('Change number 12')).toBeVisible();
    expect(screen.queryByRole('button', { name: /more commits/ })).toBeNull();
  });
});
