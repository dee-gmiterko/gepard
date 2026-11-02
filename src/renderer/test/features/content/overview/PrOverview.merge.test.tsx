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
  const listed = overviewPr(7, 'Speed up the indexer', {
    mergeReadiness: readiness,
    viewedFiles: 1,
    countedFiles: 1,
    ...row,
  });
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
    await user.click(await within(dialog).findByRole('button', { name: 'Merge anyway' }));

    await waitFor(() =>
      expect(ipc.callsTo('pr.merge')).toEqual([
        expect.objectContaining({ pr: 7, method: 'MERGE' }),
      ]),
    );
  });

  it('updates the header badge and removes the Merge button after merging from the details', async () => {
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));
    await screen.findByText('All pull requests');
    await screen.findByText('Open');
    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Merge anyway' }));

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

  it('offers the merge commit by default', async () => {
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('combobox')).toHaveValue('MERGE');
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

  it('keeps merging possible while mergeability is still unknown', async () => {
    const { user } = setup({ readiness: { state: 'CHECKING', blockers: [], warnings: [] } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('does not block merging a branch behind its base', async () => {
    const { user } = setup({ readiness: { state: 'READY', blockers: [], warnings: ['BEHIND'] } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'Merge' })).toBeEnabled();
  });
});

describe('merge confirmation for unviewed files', () => {
  it('merges directly when every file is viewed', async () => {
    const { user, ipc } = setup({ row: { viewedFiles: 3, countedFiles: 3 } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(ipc.callsTo('pr.merge')).toHaveLength(1));
  });

  it('asks again with the counts, keeps the method on Back and merges only on Merge anyway', async () => {
    const { user, ipc } = setup({ row: { viewedFiles: 1, countedFiles: 3 } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    let dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByRole('combobox'), 'REBASE');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

    expect(within(dialog).getByText('2 of 3 files are not marked as viewed.')).toBeVisible();
    expect(ipc.callsTo('pr.merge')).toEqual([]);
    expect(within(dialog).getByRole('button', { name: 'Merge anyway' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox')).toHaveValue('REBASE');
    expect(ipc.callsTo('pr.merge')).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Merge anyway' }));

    await waitFor(() =>
      expect(ipc.callsTo('pr.merge')).toEqual([
        expect.objectContaining({ pr: 7, method: 'REBASE' }),
      ]),
    );
  });

  it('never merges on the first Enter', async () => {
    const { user, ipc } = setup({ row: { viewedFiles: 0, countedFiles: 2 } });

    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox'));
    await user.keyboard('{Enter}');

    expect(ipc.callsTo('pr.merge')).toEqual([]);
  });

  it('asks for confirmation in the header dialog when the details view has unviewed files', async () => {
    const { user, ipc } = setup({ row: { viewedFiles: 3, countedFiles: 3 } });

    await user.click(await screen.findByRole('button', { name: '#7 Speed up the indexer' }));
    await screen.findByText('All pull requests');
    await user.click(await screen.findByRole('button', { name: 'Merge' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));

    expect(await within(dialog).findByText(/files are not marked as viewed/)).toBeVisible();
    expect(ipc.callsTo('pr.merge')).toEqual([]);
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
        viewedFiles={1}
        totalFiles={1}
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
