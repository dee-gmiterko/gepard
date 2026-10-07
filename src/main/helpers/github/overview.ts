import { z } from 'zod';
import {
  ForkFields,
  IsoDate,
  PrState,
  ReviewState,
  type OverviewActivity,
  type OverviewPr,
  type PrOverviewDetails,
  type ProjectOverview,
} from '@gepard/common';

export const PROJECT_OVERVIEW_QUERY = `
fragment PrFields on PullRequest {
  number title state isDraft createdAt updatedAt additions deletions changedFiles reviewDecision
  headRefName baseRefName
  isCrossRepository
  headRepository { name }
  headRepositoryOwner { login }
  author { login }
  comments { totalCount }
  latestOpinionatedReviews(first:1) { totalCount }
  reviewThreads(first:100) { nodes { isResolved comments { totalCount } } }
  files(first:100) { nodes { viewerViewedState } }
}
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    open: pullRequests(states:OPEN, first:30, orderBy:{field:UPDATED_AT, direction:DESC}) {
      nodes {
        ...PrFields
        timelineItems(last:5, itemTypes:[PULL_REQUEST_COMMIT, PULL_REQUEST_REVIEW, ISSUE_COMMENT]) {
          nodes {
            __typename
            ... on PullRequestCommit { commit { committedDate author { user { login } name } } }
            ... on PullRequestReview { submittedAt state author { login } }
            ... on IssueComment { createdAt author { login } }
          }
        }
      }
    }
    closed: pullRequests(states:[CLOSED, MERGED], first:30, orderBy:{field:UPDATED_AT, direction:DESC}) {
      nodes { ...PrFields }
    }
    merged: pullRequests(states:MERGED, first:5, orderBy:{field:UPDATED_AT, direction:DESC}) {
      nodes { number title mergedAt mergedBy { login } }
    }
  }
}`;

const Author = z.object({ login: z.string() }).nullable();

const TimelineNode = z.object({
  __typename: z.string(),
  commit: z
    .object({
      committedDate: IsoDate,
      author: z.object({ user: Author.optional(), name: z.string().nullable() }).nullable(),
    })
    .optional(),
  submittedAt: IsoDate.nullable().optional(),
  state: ReviewState.optional(),
  createdAt: IsoDate.optional(),
  author: Author.optional(),
});

const PrNode = z.object({
  number: z.int().positive(),
  title: z.string(),
  state: PrState,
  isDraft: z.boolean(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  changedFiles: z.int().nonnegative(),
  reviewDecision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']).nullable(),
  headRefName: z.string(),
  baseRefName: z.string(),
  ...ForkFields,
  author: Author,
  comments: z.object({ totalCount: z.int().nonnegative() }),
  latestOpinionatedReviews: z.object({ totalCount: z.int().nonnegative() }),
  reviewThreads: z.object({
    nodes: z.array(
      z.object({
        isResolved: z.boolean(),
        comments: z.object({ totalCount: z.int().nonnegative() }),
      }),
    ),
  }),
  files: z.object({ nodes: z.array(z.object({ viewerViewedState: z.string() })) }),
});

const OpenPrNode = PrNode.extend({
  timelineItems: z.object({ nodes: z.array(TimelineNode.nullable()) }),
});

const MergedPrNode = z.object({
  number: z.int().positive(),
  title: z.string(),
  mergedAt: IsoDate.nullable(),
  mergedBy: Author,
});

export const ProjectOverviewResponse = z.object({
  data: z.object({
    repository: z.object({
      open: z.object({ nodes: z.array(OpenPrNode) }),
      closed: z.object({ nodes: z.array(PrNode) }),
      merged: z.object({ nodes: z.array(MergedPrNode) }),
    }),
  }),
  errors: z.array(z.object({ message: z.string() })).optional(),
});
export type ProjectOverviewResponse = z.infer<typeof ProjectOverviewResponse>;

export const ACTIVITY_LIMIT = 15;

function timelineActivity(
  node: z.infer<typeof TimelineNode>,
  pr: { number: number; title: string },
): OverviewActivity | null {
  const base = { pr: pr.number, prTitle: pr.title, reviewState: null };
  if (node.__typename === 'PullRequestCommit' && node.commit) {
    const { author } = node.commit;
    return {
      ...base,
      kind: 'commit',
      at: node.commit.committedDate,
      actor: author?.user?.login ?? author?.name ?? null,
    };
  }
  if (node.__typename === 'PullRequestReview' && node.submittedAt) {
    return {
      ...base,
      kind: 'review',
      at: node.submittedAt,
      actor: node.author?.login ?? null,
      reviewState: node.state ?? null,
    };
  }
  if (node.__typename === 'IssueComment' && node.createdAt) {
    return { ...base, kind: 'comment', at: node.createdAt, actor: node.author?.login ?? null };
  }
  return null;
}

// GitHub returns no reviewDecision when the base branch requires no reviews.
function isReviewed(node: z.infer<typeof PrNode>): boolean {
  if (node.reviewDecision) return node.reviewDecision !== 'REVIEW_REQUIRED';
  return node.latestOpinionatedReviews.totalCount > 0;
}

function toOverviewPr(node: z.infer<typeof PrNode>): OverviewPr {
  const threads = node.reviewThreads.nodes;
  return {
    number: node.number,
    title: node.title,
    author: node.author?.login ?? null,
    state: node.state,
    isDraft: node.isDraft,
    reviewed: isReviewed(node),
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    isCrossRepository: node.isCrossRepository,
    headRepository: node.headRepository,
    headRepositoryOwner: node.headRepositoryOwner,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    comments: node.comments.totalCount + threads.reduce((sum, t) => sum + t.comments.totalCount, 0),
    unresolvedThreads: threads.filter((t) => !t.isResolved).length,
    reviewDecision: node.reviewDecision,
    viewedFiles: node.files.nodes.filter((f) => f.viewerViewedState === 'VIEWED').length,
    countedFiles: node.files.nodes.length,
  };
}

export function parseProjectOverview(response: ProjectOverviewResponse): ProjectOverview {
  const { open, closed, merged } = response.data.repository;
  const activity: OverviewActivity[] = [];

  const prs = open.nodes.map((node): OverviewPr => {
    for (const item of node.timelineItems.nodes) {
      const entry = item && timelineActivity(item, node);
      if (entry) activity.push(entry);
    }
    return toOverviewPr(node);
  });

  for (const node of merged.nodes) {
    if (!node.mergedAt) continue;
    activity.push({
      kind: 'merged',
      at: node.mergedAt,
      actor: node.mergedBy?.login ?? null,
      pr: node.number,
      prTitle: node.title,
      reviewState: null,
    });
  }

  activity.sort((a, b) => b.at.localeCompare(a.at));
  return {
    prs,
    closedPrs: closed.nodes.map(toOverviewPr),
    activity: activity.slice(0, ACTIVITY_LIMIT),
  };
}

const GhReviewDecision = z
  .enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED', ''])
  .nullable()
  .transform((v) => v || null);

const GhReviewRequest = z.object({ login: z.string().optional(), name: z.string().optional() });

export const GhPrOverview = z.object({
  state: PrState,
  isDraft: z.boolean(),
  body: z.string(),
  updatedAt: IsoDate,
  mergedAt: IsoDate.nullable(),
  closedAt: IsoDate.nullable(),
  reviewDecision: GhReviewDecision,
  reviews: z.array(
    z.object({
      author: z.object({ login: z.string() }).nullable(),
      state: ReviewState,
      submittedAt: IsoDate.nullable(),
    }),
  ),
  reviewRequests: z.array(GhReviewRequest),
});
export type GhPrOverview = z.infer<typeof GhPrOverview>;

export const PR_OVERVIEW_FIELDS =
  'state,isDraft,body,updatedAt,mergedAt,closedAt,reviewDecision,reviews,reviewRequests';

export function normalizePrOverview(raw: GhPrOverview): PrOverviewDetails {
  return {
    state: raw.state,
    isDraft: raw.isDraft,
    body: raw.body,
    updatedAt: raw.updatedAt,
    mergedAt: raw.mergedAt,
    closedAt: raw.closedAt,
    reviewDecision: raw.reviewDecision,
    reviews: raw.reviews.flatMap((r) =>
      r.submittedAt
        ? [{ author: r.author?.login ?? null, state: r.state, submittedAt: r.submittedAt }]
        : [],
    ),
    reviewRequests: raw.reviewRequests.flatMap((r) => {
      const name = r.login ?? r.name;
      return name ? [name] : [];
    }),
  };
}
