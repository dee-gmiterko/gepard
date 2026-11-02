import { z } from 'zod';
import type { MergeBlocker, MergeReadiness, MergeWarning } from '@gepard/common';

export const GhMergeable = z.enum(['MERGEABLE', 'CONFLICTING', 'UNKNOWN']).catch('UNKNOWN');
export const GhMergeStateStatus = z
  .enum(['BEHIND', 'BLOCKED', 'CLEAN', 'DIRTY', 'DRAFT', 'HAS_HOOKS', 'UNKNOWN', 'UNSTABLE'])
  .catch('UNKNOWN');

export interface CheckTally {
  failing: number;
  pending: number;
}

const FAILED_CONCLUSIONS: ReadonlySet<string> = new Set([
  'FAILURE',
  'TIMED_OUT',
  'CANCELLED',
  'STARTUP_FAILURE',
  'ACTION_REQUIRED',
  'ERROR',
]);

export const GhCheck = z.object({
  status: z.string().optional(),
  conclusion: z.string().nullish(),
  state: z.string().optional(),
});
export type GhCheck = z.infer<typeof GhCheck>;

export function tallyChecks(checks: readonly GhCheck[]): CheckTally {
  const tally: CheckTally = { failing: 0, pending: 0 };
  for (const check of checks) {
    if (check.state !== undefined) {
      if (check.state === 'FAILURE' || check.state === 'ERROR') tally.failing += 1;
      else if (check.state === 'PENDING' || check.state === 'EXPECTED') tally.pending += 1;
    } else if (check.status !== undefined && check.status !== 'COMPLETED') {
      tally.pending += 1;
    } else if (check.conclusion && FAILED_CONCLUSIONS.has(check.conclusion)) {
      tally.failing += 1;
    }
  }
  return tally;
}

export function tallyRollupState(state: string | null): CheckTally {
  if (state === 'FAILURE' || state === 'ERROR') return { failing: 1, pending: 0 };
  if (state === 'PENDING' || state === 'EXPECTED') return { failing: 0, pending: 1 };
  return { failing: 0, pending: 0 };
}

export function deriveMergeReadiness(input: {
  isDraft: boolean;
  mergeable: z.infer<typeof GhMergeable>;
  mergeStateStatus: z.infer<typeof GhMergeStateStatus>;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  checks: CheckTally;
}): MergeReadiness {
  const { mergeable, mergeStateStatus: status, checks, reviewDecision } = input;
  if (mergeable === 'CONFLICTING' || status === 'DIRTY') {
    return { state: 'CONFLICTING', blockers: [], warnings: [] };
  }
  if (input.isDraft || status === 'DRAFT') {
    return { state: 'BLOCKED', blockers: ['DRAFT'], warnings: [] };
  }
  if (mergeable === 'UNKNOWN' || status === 'UNKNOWN') {
    return { state: 'CHECKING', blockers: [], warnings: [] };
  }
  if (status === 'BLOCKED') {
    const blockers: MergeBlocker[] = [];
    if (reviewDecision === 'CHANGES_REQUESTED') blockers.push('CHANGES_REQUESTED');
    if (reviewDecision === 'REVIEW_REQUIRED') blockers.push('REVIEW_REQUIRED');
    if (checks.failing > 0) blockers.push('CHECKS_FAILING');
    if (checks.pending > 0) blockers.push('CHECKS_PENDING');
    return { state: 'BLOCKED', blockers: blockers.length > 0 ? blockers : ['OTHER'], warnings: [] };
  }
  const warnings: MergeWarning[] = [];
  if (status === 'BEHIND') warnings.push('BEHIND');
  if (status === 'UNSTABLE') warnings.push('CHECKS_FAILING');
  return { state: 'READY', blockers: [], warnings };
}
