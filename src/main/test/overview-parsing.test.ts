import { describe, expect, it } from 'vitest';
import {
  GhPrOverview,
  normalizePrOverview,
  parseProjectOverview,
  type ProjectOverviewResponse,
} from '../helpers/github/overview';

const T = (n: number): string => `2026-01-0${n}T00:00:00Z`;

function prNode(
  overrides: Partial<ProjectOverviewResponse['data']['repository']['closed']['nodes'][number]> = {},
): ProjectOverviewResponse['data']['repository']['closed']['nodes'][number] {
  return {
    number: 7,
    title: 'Add thing',
    state: 'OPEN',
    isDraft: false,
    createdAt: T(1),
    updatedAt: T(4),
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    reviewDecision: null,
    headRefName: 'thing',
    baseRefName: 'main',
    author: { login: 'ann' },
    comments: { totalCount: 1 },
    latestOpinionatedReviews: { totalCount: 0 },
    reviewThreads: {
      nodes: [
        { isResolved: true, comments: { totalCount: 2 } },
        { isResolved: false, comments: { totalCount: 3 } },
      ],
    },
    files: {
      nodes: [
        { viewerViewedState: 'VIEWED' },
        { viewerViewedState: 'UNVIEWED' },
        { viewerViewedState: 'VIEWED' },
      ],
    },
    ...overrides,
  };
}

function response(): ProjectOverviewResponse {
  return {
    data: {
      repository: {
        open: {
          nodes: [
            {
              ...prNode(),
              timelineItems: {
                nodes: [
                  {
                    __typename: 'PullRequestCommit',
                    commit: { committedDate: T(2), author: { user: null, name: 'Ann A' } },
                  },
                  { __typename: 'PullRequestReview', submittedAt: null, state: 'PENDING' },
                  {
                    __typename: 'PullRequestReview',
                    submittedAt: T(3),
                    state: 'APPROVED',
                    author: { login: 'bob' },
                  },
                  null,
                ],
              },
            },
          ],
        },
        closed: { nodes: [prNode({ number: 6, state: 'MERGED' })] },
        merged: {
          nodes: [
            { number: 5, title: 'Old', mergedAt: T(5), mergedBy: { login: 'cy' } },
            { number: 4, title: 'Never', mergedAt: null, mergedBy: null },
          ],
        },
      },
    },
  };
}

describe('parseProjectOverview', () => {
  it('sums comments, counts unresolved threads and viewed files', () => {
    const { prs } = parseProjectOverview(response());
    expect(prs[0]).toMatchObject({
      comments: 6,
      unresolvedThreads: 1,
      viewedFiles: 2,
      countedFiles: 3,
      author: 'ann',
    });
  });

  it('keeps closed and merged PRs apart from the open ones', () => {
    const { prs, closedPrs } = parseProjectOverview(response());
    expect(prs.map((p) => p.number)).toEqual([7]);
    expect(closedPrs.map((p) => [p.number, p.state])).toEqual([[6, 'MERGED']]);
  });

  it.each([
    ['REVIEW_REQUIRED', 1, false],
    ['APPROVED', 0, true],
    ['CHANGES_REQUESTED', 0, true],
    [null, 0, false],
    [null, 1, true],
  ] as const)(
    'decision %s with %i opinionated reviews: reviewed %s',
    (decision, count, reviewed) => {
      const response = {
        data: {
          repository: {
            open: {
              nodes: [
                {
                  ...prNode({
                    reviewDecision: decision,
                    latestOpinionatedReviews: { totalCount: count },
                  }),
                  timelineItems: { nodes: [] },
                },
              ],
            },
            closed: { nodes: [] },
            merged: { nodes: [] },
          },
        },
      };
      expect(parseProjectOverview(response).prs[0]?.reviewed).toBe(reviewed);
    },
  );

  it('merges activity newest first, skipping pending reviews and unmerged PRs', () => {
    const { activity } = parseProjectOverview(response());
    expect(activity.map((a) => [a.kind, a.actor, a.pr])).toEqual([
      ['merged', 'cy', 5],
      ['review', 'bob', 7],
      ['commit', 'Ann A', 7],
    ]);
  });
});

describe('normalizePrOverview', () => {
  it('maps empty decisions to null, drops unsubmitted reviews and names team requests', () => {
    const raw = GhPrOverview.parse({
      state: 'OPEN',
      isDraft: false,
      body: '',
      updatedAt: T(1),
      mergedAt: null,
      closedAt: null,
      reviewDecision: '',
      reviews: [
        { author: { login: 'a' }, state: 'APPROVED', submittedAt: T(2) },
        { author: null, state: 'PENDING', submittedAt: null },
      ],
      reviewRequests: [{ login: 'u' }, { name: 'team' }],
    });
    const out = normalizePrOverview(raw);
    expect(out.reviewDecision).toBeNull();
    expect(out.reviews).toHaveLength(1);
    expect(out.reviewRequests).toEqual(['u', 'team']);
  });
});
