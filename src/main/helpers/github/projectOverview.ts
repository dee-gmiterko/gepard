import { z } from 'zod';
import {
  ForkFields,
  IsoDate,
  PrState,
  ReviewState,
  type OverviewActivity,
  type OverviewPr,
  type ProjectOverview,
} from '@gepard/common';
import {
  deriveMergeReadiness,
  GhMergeable,
  GhMergeStateStatus,
  tallyRollupState,
} from './mergeReadiness';

export const PROJECT_OVERVIEW_QUERY = `
fragment PrFields on PullRequest {
  number title state isDraft createdAt updatedAt additions deletions changedFiles reviewDecision
  headRefName baseRefName
  mergeable mergeStateStatus
  commits(last:1) { nodes { commit { statusCheckRollup { state } } } }
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

const PrNode = ForkFields.extend({
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
  mergeable: GhMergeable,
  mergeStateStatus: GhMergeStateStatus,
  commits: z.object({
    nodes: z.array(
      z.object({
        commit: z.object({ statusCheckRollup: z.object({ state: z.string() }).nullable() }),
      }),
    ),
  }),
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
    mergeReadiness: deriveMergeReadiness({
      isDraft: node.isDraft,
      mergeable: node.mergeable,
      mergeStateStatus: node.mergeStateStatus,
      reviewDecision: node.reviewDecision,
      checks: tallyRollupState(node.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null),
    }),
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
