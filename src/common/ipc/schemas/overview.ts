import { z } from 'zod';
import { IsoDate, Login, ReviewState } from './pr';

export const ReviewDecision = z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED']);
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const PrState = z.enum(['OPEN', 'CLOSED', 'MERGED']);
export type PrState = z.infer<typeof PrState>;

export const OverviewPr = z.object({
  number: z.int().positive(),
  title: z.string(),
  author: Login.nullable(),
  state: PrState,
  isDraft: z.boolean(),
  reviewed: z.boolean(),
  headRefName: z.string(),
  baseRefName: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  changedFiles: z.int().nonnegative(),
  comments: z.int().nonnegative(),
  unresolvedThreads: z.int().nonnegative(),
  reviewDecision: ReviewDecision.nullable(),
  viewedFiles: z.int().nonnegative(),
  countedFiles: z.int().nonnegative(),
});
export type OverviewPr = z.infer<typeof OverviewPr>;

export const ActivityKind = z.enum(['commit', 'review', 'comment', 'merged']);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const OverviewActivity = z.object({
  kind: ActivityKind,
  at: IsoDate,
  actor: z.string().nullable(),
  pr: z.int().positive(),
  prTitle: z.string(),
  reviewState: ReviewState.nullable(),
});
export type OverviewActivity = z.infer<typeof OverviewActivity>;

export const ProjectOverview = z.object({
  prs: z.array(OverviewPr),
  closedPrs: z.array(OverviewPr),
  activity: z.array(OverviewActivity),
});
export type ProjectOverview = z.infer<typeof ProjectOverview>;

export const PrOverviewDetails = z.object({
  state: PrState,
  isDraft: z.boolean(),
  body: z.string(),
  updatedAt: IsoDate,
  mergedAt: IsoDate.nullable(),
  closedAt: IsoDate.nullable(),
  reviewDecision: ReviewDecision.nullable(),
  reviews: z.array(
    z.object({
      author: Login.nullable(),
      state: ReviewState,
      submittedAt: IsoDate,
    }),
  ),
  reviewRequests: z.array(z.string()),
});
export type PrOverviewDetails = z.infer<typeof PrOverviewDetails>;

export const ChangedFileOwners = z.record(z.string(), z.array(z.string()));
export type ChangedFileOwners = z.infer<typeof ChangedFileOwners>;
