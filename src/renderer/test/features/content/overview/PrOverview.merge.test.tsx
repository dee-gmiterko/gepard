import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { OverviewPr, PrOverviewDetails } from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders } from '../../../support/render';
import { createWorld, overviewPr, pr } from '../../../support/world';

const details: PrOverviewDetails = {
  state: 'OPEN',
  isDraft: false,
  body: 'Body',
  updatedAt: '2026-01-01T00:00:00Z',
  mergedAt: null,
  closedAt: null,
  reviewDecision: null,
  reviews: [],
  reviewRequests: [],
};

function setup({
  decision = null,
  row = {},
}: {
  decision?: PrOverviewDetails['reviewDecision'];
  row?: Partial<OverviewPr>;
} = {}): ReturnType<typeof renderWithProviders> {
  const listed = overviewPr(7, 'Speed up the indexer', { reviewDecision: decision, ...row });
  const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], overviewPrs: [listed] });
  const state = { merged: false };
  const handlers = {
    ...world.handlers,
    'overview.pr': (): PrOverviewDetails =>
      state.merged
        ? { ...details, state: 'MERGED', mergedAt: '2026-01-02T00:00:00Z' }
        : { ...details, reviewDecision: decision },
    'overview.project': () => ({ prs: state.merged ? [] : [listed], closedPrs: [], activity: [] }),
    'pr.merge': () => {
      state.merged = true;
    },
  };
  return renderWithProviders(<App />, handlers);
}

describe('PR overview merge dialog', () => {
  it('opens the details of a PR without targeting it', async () => {
    const { user, ipc } = setup();

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));

    expect(await screen.findByText('All pull requests')).toBeVisible();
    expect(ipc.callsTo('pr.checkout').every((c) => c.target.kind === 'default')).toBe(true);
  });

  it('merges from the pull request list with the chosen method', async () => {
    const { user, ipc } = setup();

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByRole('combobox'), 'SQUASH');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ipc.callsTo('pr.merge')).toEqual([expect.objectContaining({ pr: 7, method: 'SQUASH' })]);
  });

  it('merges from the details view', async () => {
    const { user, ipc } = setup();

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));
    await screen.findByText('All pull requests');
    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

    expect(ipc.callsTo('pr.merge')).toEqual([expect.objectContaining({ pr: 7, method: 'MERGE' })]);
  });

  it('updates the header badge and removes the Merge button after merging from the details', async () => {
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));
    await screen.findByText('All pull requests');
    await screen.findByText('Open');
    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Merge' }),
    );

    await waitFor(() => expect(screen.queryByText('Open')).toBeNull());
    expect((await screen.findAllByText('Merged')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops the row and its dialog cleanly when the merged PR leaves the list', async () => {
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Merge' }),
    );

    await waitFor(() => expect(screen.queryByText('#7 Speed up the indexer')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['CHANGES_REQUESTED', 'Changes have been requested on this pull request.'],
    ['REVIEW_REQUIRED', 'This pull request has not been approved yet.'],
  ] as const)(
    'warns before merging a PR with decision %s but still allows it',
    async (decision, warning) => {
      const { user, ipc } = setup({ decision });

      await user.click(await screen.findByRole('button', { name: 'Merge' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(warning)).toBeVisible();
      await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

      await waitFor(() => expect(ipc.callsTo('pr.merge')).toHaveLength(1));
    },
  );

  it('shows no warning for an approved PR', async () => {
    const { user } = setup({ decision: 'APPROVED' });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/not been approved|requested/)).toBeNull();
  });
});
