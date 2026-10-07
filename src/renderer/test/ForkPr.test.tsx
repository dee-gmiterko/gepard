import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import App from '../src/App';
import { renderWithProviders } from './support/render';
import { findOption } from './support/options';
import { createWorld, forkOf, overviewPr, pr } from './support/world';

const sameRepo = pr(7, 'Speed up the indexer');
const fork = forkOf(pr(8, 'Add feature flags'), 'carol');

describe('fork pull requests', () => {
  it('marks a fork PR in the PR combo box with its owner:branch and finds it by owner', async () => {
    const world = createWorld({ prs: [sameRepo, fork] });
    const { user } = renderWithProviders(<App />, world.handlers);
    const input = await screen.findByPlaceholderText('PR…');

    await user.click(input);
    expect(await findOption('#7 Speed up the indexer')).toBeVisible();
    expect(await findOption('#8 Add feature flags (fork: carol:feature-8)')).toBeVisible();

    await user.type(input, 'carol');
    expect(await findOption('#8 Add feature flags (fork: carol:feature-8)')).toBeVisible();
    expect(screen.queryByText('#7 Speed up the indexer')).toBeNull();
  });

  it('shows the fork badge and owner:branch in the PR header of a fork PR', async () => {
    const world = createWorld({ prs: [fork], targeting: { pr: 8 } });
    renderWithProviders(<App />, world.handlers);

    expect(await screen.findByText('Fork')).toBeVisible();
    expect(await screen.findByText(/wants to merge carol:feature-8 into main/)).toBeVisible();
  });

  it('shows no fork marker in the PR header of a same-repo PR', async () => {
    const world = createWorld({ prs: [sameRepo], targeting: { pr: 7 } });
    renderWithProviders(<App />, world.handlers);

    expect(await screen.findByText(/wants to merge feature-7 into main/)).toBeVisible();
    expect(screen.queryByText('Fork')).toBeNull();
  });

  it('marks a fork PR row in the project overview and leaves other rows unmarked', async () => {
    const world = createWorld({
      overviewPrs: [
        overviewPr(7, 'Speed up the indexer'),
        overviewPr(8, 'Add feature flags', {
          isCrossRepository: true,
          headRepository: { name: 'widgets' },
          headRepositoryOwner: { login: 'carol' },
        }),
      ],
    });
    renderWithProviders(<App />, world.handlers);

    expect(await screen.findByText('#8 Add feature flags')).toBeVisible();
    expect(screen.getByText('#7 Speed up the indexer')).toBeVisible();
    const badges = screen.getAllByText('Fork');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute('title', 'carol:feature-8');
  });
});
