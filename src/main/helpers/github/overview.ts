import { z } from 'zod';
import {
  IsoDate,
  ReviewState,
  type OverviewActivity,
  type OverviewPr,
  type PrOverviewDetails,
} from '@gepard/common';

export const PROJECT_OVERVIEW_QUERY = `
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    open: pullRequests(states:OPEN, first:30, orderBy:{field:UPDATED_AT, direction:DESC}) {
      nodes {
        number title isDraft createdAt updatedAt additions deletions changedFiles reviewDecision
        headRefName baseRefName
        author { login }
        comments { totalCount }
        reviewThreads(first:100) { nodes { isResolved comments { totalCount } } }
        files(first:100) { nodes { viewerViewedState } }
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

const OpenPrNode = z.object({
  number: z.int().positive(),
  title: z.string(),
  isDraft: z.boolean(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  changedFiles: z.int().nonnegative(),
  reviewDecision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']).nullable(),
  headRefName: z.string(),
  baseRefName: z.string(),
  author: Author,
  comments: z.object({ totalCount: z.int().nonnegative() }),
  reviewThreads: z.object({
    nodes: z.array(
      z.object({
        isResolved: z.boolean(),
        comments: z.object({ totalCount: z.int().nonnegative() }),
      }),
    ),
  }),
  files: z.object({ nodes: z.array(z.object({ viewerViewedState: z.string() })) }),
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

export function parseProjectOverview(response: ProjectOverviewResponse): {
  prs: OverviewPr[];
  activity: OverviewActivity[];
} {
  const { open, merged } = response.data.repository;
  const activity: OverviewActivity[] = [];

  const prs = open.nodes.map((node): OverviewPr => {
    for (const item of node.timelineItems.nodes) {
      const entry = item && timelineActivity(item, node);
      if (entry) activity.push(entry);
    }
    const threads = node.reviewThreads.nodes;
    return {
      number: node.number,
      title: node.title,
      author: node.author?.login ?? null,
      isDraft: node.isDraft,
      headRefName: node.headRefName,
      baseRefName: node.baseRefName,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      additions: node.additions,
      deletions: node.deletions,
      changedFiles: node.changedFiles,
      comments:
        node.comments.totalCount + threads.reduce((sum, t) => sum + t.comments.totalCount, 0),
      unresolvedThreads: threads.filter((t) => !t.isResolved).length,
      reviewDecision: node.reviewDecision,
      viewedFiles: node.files.nodes.filter((f) => f.viewerViewedState === 'VIEWED').length,
      countedFiles: node.files.nodes.length,
    };
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
  return { prs, activity: activity.slice(0, ACTIVITY_LIMIT) };
}

const GhReviewDecision = z
  .enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED', ''])
  .nullable()
  .transform((v) => v || null);

const GhReviewRequest = z.object({ login: z.string().optional(), name: z.string().optional() });

export const GhPrOverview = z.object({
  state: z.enum(['OPEN', 'CLOSED', 'MERGED']),
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
