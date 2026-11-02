import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type {
  AllowedMergeMethods,
  MergeReadiness,
  OverviewPr,
  PrOverviewDetails,
} from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders } from '../../../support/render';
import { MergeModal } from '../../../../src/features/content/overview/shared/MergeModal';
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

const READY: MergeReadiness = { state: 'READY', blockers: [], warnings: [] };

function setup({
  readiness = READY,
  methods = { merge: true, squash: true, rebase: true },
  row = {},
}: {
  readiness?: MergeReadiness;
  methods?: AllowedMergeMethods;
  row?: Partial<OverviewPr>;
} = {}): ReturnType<typeof renderWithProviders> {
  const listed = overviewPr(7, 'Speed up the indexer', { mergeReadiness: readiness, ...row });
  const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], overviewPrs: [listed] });
  const state = { merged: false };
  const handlers = {
    ...world.handlers,
    'overview.pr': (): PrOverviewDetails =>
      state.merged
        ? { ...details, state: 'MERGED', mergedAt: '2026-01-02T00:00:00Z' }
        : { ...details, mergeReadiness: readiness },
    'overview.project': () => ({ prs: state.merged ? [] : [listed], closedPrs: [], activity: [] }),
    'pr.mergeMethods': () => methods,
    'pr.merge': () => {
      state.merged = true;
    },
  };
  return renderWithProviders(<App />, handlers);
}

describe('PR overview merge dialog', () => {
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

  it('shows what is merged into what and offers the merge commit by default', async () => {
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('feature-7 into main')).toBeVisible();
    expect(within(dialog).getByRole('combobox')).toHaveValue('MERGE');
    expect(within(dialog).getByText('Ready to merge.')).toBeVisible();
  });

  it('does not offer merge methods the repository disallows', async () => {
    const { user } = setup({ methods: { merge: true, squash: false, rebase: false } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    await waitFor(() =>
      expect(
        within(dialog)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Create a merge commit']),
    );
    expect(within(dialog).getByRole('combobox')).toHaveValue('MERGE');
  });

  it('disables Merge with the reason for conflicts, in the list and in the details', async () => {
    const { user } = setup({ readiness: { state: 'CONFLICTING', blockers: [], warnings: [] } });

    const listButton = await screen.findByRole('button', { name: 'Merge' });
    expect(listButton).toBeDisabled();
    expect(listButton).toHaveAttribute('title', expect.stringMatching(/conflicts/));

    await user.click(screen.getByRole('button', { name: '#7 Speed up the indexer' }));
    await screen.findByText('All pull requests');
    const headerButton = await screen.findByRole('button', { name: 'Merge' });
    expect(headerButton).toBeDisabled();
    expect(headerButton).toHaveAttribute('title', expect.stringMatching(/conflicts/));
  });

  it('disables Merge and lists the blockers when GitHub would reject the merge', async () => {
    setup({
      readiness: {
        state: 'BLOCKED',
        blockers: ['REVIEW_REQUIRED', 'CHECKS_PENDING'],
        warnings: [],
      },
    });

    const button = await screen.findByRole('button', { name: 'Merge' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      expect.stringContaining('A required review is missing.'),
    );
    expect(button).toHaveAttribute(
      'title',
      expect.stringContaining('Some checks are still running.'),
    );
  });

  it('hides Merge for draft pull requests', async () => {
    setup({
      readiness: { state: 'BLOCKED', blockers: ['DRAFT'], warnings: [] },
      row: { isDraft: true },
    });

    await screen.findByText('#7 Speed up the indexer');
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });

  it('shows a neutral checking state and keeps merging possible', async () => {
    const { user } = setup({ readiness: { state: 'CHECKING', blockers: [], warnings: [] } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(/Checking whether/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('warns about a branch behind its base without blocking', async () => {
    const { user } = setup({ readiness: { state: 'READY', blockers: [], warnings: ['BEHIND'] } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('The branch is behind its base branch.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeEnabled();
  });
});

describe('MergeModal confirm', () => {
  function renderModal(readiness: MergeReadiness): ReturnType<typeof renderWithProviders> {
    const world = createWorld();
    return renderWithProviders(
      <MergeModal
        pr={7}
        title="Speed up the indexer"
        head="feature-7"
        base="main"
        mergeReadiness={readiness}
        onClose={() => undefined}
      />,
      world.handlers,
    );
  }

  it.each([
    [{ state: 'CONFLICTING', blockers: [], warnings: [] }, /conflicts/],
    [{ state: 'BLOCKED', blockers: ['CHECKS_FAILING'], warnings: [] }, /Some checks are failing/],
  ] as const)('disables confirm for %j and says why', async (readiness, reason) => {
    renderModal({ ...readiness, blockers: [...readiness.blockers], warnings: [] });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(reason)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeDisabled();
  });
});
