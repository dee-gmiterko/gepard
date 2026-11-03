import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Commit, GraphCommit, GraphPage, PrOverviewDetails } from '@gepard/common';
import App from '../../../../src/App';
import { renderWithProviders } from '../../../support/render';
import { createWorld, HEAD, pr, sha } from '../../../support/world';

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
    oid: sha(String(n)),
    messageHeadline: `Change number ${n}`,
    messageBody: '',
    authoredDate: `2026-01-01T10:0${n}:00Z`,
    committedDate: `2026-01-01T10:0${n}:00Z`,
    authors: [{ login: 'alice', name: 'Alice', email: 'a@example.com' }],
  };
}

function node(oid: string, parents: string[], refs: string[] = []): GraphCommit {
  return {
    oid,
    parents,
    messageHeadline: `Node ${oid.slice(0, 3)}`,
    committedDate: '2026-01-01T10:00:00Z',
    authorName: 'Alice',
    refs,
  };
}

function renderOverview(
  pages: (offset: number) => GraphPage,
  commits: Commit[] = [],
): ReturnType<typeof renderWithProviders> {
  const world = createWorld({ prs: [pr(7, 'Speed up the indexer')], targeting: { pr: 7 } });
  return renderWithProviders(<App />, {
    ...world.handlers,
    'overview.pr': () => details,
    'pr.commits': () => commits,
    'commits.graph': ({ offset }) => pages(offset),
  });
}

const A = sha('1');
const B = sha('2');
const C = sha('3');
const D = sha('4');

describe('PR overview git tree', () => {
  it('shows commit history beyond the branch with ref labels on the left and authors', async () => {
    renderOverview(
      () => ({
        commits: [
          node(HEAD, [B]),
          node(B, [C], ['main']),
          node(A, [C], ['origin-only']),
          node(C, [D]),
          node(D, []),
        ],
        nextOffset: null,
      }),
      [commit(1)],
    );

    const tree = await screen.findByRole('region', { name: 'Commits' });
    const items = await within(tree).findAllByRole('listitem');

    expect(items).toHaveLength(5);
    expect(within(items[0]).getByText('feature-7')).toBeTruthy();
    expect(within(items[1]).getByText('main')).toBeTruthy();
    expect(within(items[2]).getByText('origin-only')).toBeTruthy();
    expect(within(items[4]).getByText('Node 444')).toBeTruthy();
    expect(within(items[0]).getByText('Alice')).toBeTruthy();
    expect(items[0].querySelector('svg')).not.toBeNull();
  });

  it('draws no rail for a single commit', async () => {
    renderOverview(() => ({ commits: [node(HEAD, [])], nextOffset: null }));

    const tree = await screen.findByRole('region', { name: 'Commits' });
    const items = await within(tree).findAllByRole('listitem');

    expect(items).toHaveLength(1);
    expect(items[0].querySelectorAll('line')).toHaveLength(0);
    expect(within(items[0]).getByText('feature-7')).toBeTruthy();
  });

  it('loads the next page when the container is scrolled near its end', async () => {
    const offsets: number[] = [];
    renderOverview((offset) => {
      offsets.push(offset);
      return offset === 0
        ? { commits: [node(HEAD, [B]), node(B, [C])], nextOffset: 2 }
        : { commits: [node(C, [])], nextOffset: null };
    });

    const tree = await screen.findByRole('region', { name: 'Commits' });
    await within(tree).findAllByRole('listitem');
    expect(offsets).toEqual([0]);

    const scroller = tree.querySelector('ol')?.parentElement as HTMLElement;
    fireEvent.scroll(scroller);

    await waitFor(() => expect(within(tree).getAllByRole('listitem')).toHaveLength(3));
    expect(offsets).toEqual([0, 2]);
  });

  it('opens a commit from its headline', async () => {
    const { user } = renderOverview(() => ({ commits: [node(HEAD, [])], nextOffset: null }));

    const tree = await screen.findByRole('region', { name: 'Commits' });
    await user.click(await within(tree).findByRole('button', { name: 'Node aaa' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Commits' })).toBeNull());
  });

  it('puts description and timeline in the main column and reviewers in the side pane', async () => {
    renderOverview(() => ({ commits: [node(HEAD, [])], nextOffset: null }));

    const reviewers = await screen.findByRole('region', { name: 'Reviewers' });
    const description = await screen.findByRole('region', { name: 'Description' });
    const timeline = await screen.findByRole('region', { name: 'Timeline' });

    expect(description.parentElement).toBe(timeline.parentElement);
    expect(reviewers.parentElement).not.toBe(description.parentElement);
    expect(reviewers.parentElement?.parentElement).toBe(description.parentElement?.parentElement);
  });
});
