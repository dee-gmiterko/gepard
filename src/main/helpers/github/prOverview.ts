import { z } from 'zod';
import { IsoDate, PrState, ReviewState, type PrOverviewDetails } from '@gepard/common';
import {
  deriveMergeReadiness,
  GhCheck,
  GhMergeable,
  GhMergeStateStatus,
  tallyChecks,
} from './mergeReadiness';

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
  mergeable: GhMergeable,
  mergeStateStatus: GhMergeStateStatus,
  statusCheckRollup: z.array(GhCheck),
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
  'state,isDraft,body,updatedAt,mergedAt,closedAt,reviewDecision,reviews,reviewRequests,mergeable,mergeStateStatus,statusCheckRollup';

export function normalizePrOverview(raw: GhPrOverview): PrOverviewDetails {
  return {
    state: raw.state,
    isDraft: raw.isDraft,
    body: raw.body,
    updatedAt: raw.updatedAt,
    mergedAt: raw.mergedAt,
    closedAt: raw.closedAt,
    reviewDecision: raw.reviewDecision,
    mergeReadiness: deriveMergeReadiness({
      isDraft: raw.isDraft,
      mergeable: raw.mergeable,
      mergeStateStatus: raw.mergeStateStatus,
      reviewDecision: raw.reviewDecision,
      checks: tallyChecks(raw.statusCheckRollup),
    }),
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
