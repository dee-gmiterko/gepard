import { describe, expect, it } from 'vitest';
import {
  deriveMergeReadiness,
  GhMergeable,
  GhMergeStateStatus,
  tallyChecks,
  tallyRollupState,
} from '../../../helpers/github/mergeReadiness';

type Input = Parameters<typeof deriveMergeReadiness>[0];

function derive(overrides: Partial<Input>): ReturnType<typeof deriveMergeReadiness> {
  return deriveMergeReadiness({
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: null,
    checks: { failing: 0, pending: 0 },
    ...overrides,
  });
}

describe('deriveMergeReadiness', () => {
  it('treats CLEAN and HAS_HOOKS as ready', () => {
    expect(derive({})).toEqual({ state: 'READY', blockers: [], warnings: [] });
    expect(derive({ mergeStateStatus: 'HAS_HOOKS' }).state).toBe('READY');
  });

  it('reports conflicts from mergeable or from DIRTY, ahead of any block', () => {
    expect(derive({ mergeable: 'CONFLICTING', mergeStateStatus: 'BLOCKED' }).state).toBe(
      'CONFLICTING',
    );
    expect(derive({ mergeStateStatus: 'DIRTY' }).state).toBe('CONFLICTING');
  });

  it('reports a neutral checking state while GitHub has not computed mergeability', () => {
    expect(derive({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' }).state).toBe('CHECKING');
    expect(derive({ mergeable: 'UNKNOWN' }).state).toBe('CHECKING');
    expect(derive({ mergeStateStatus: 'UNKNOWN' }).state).toBe('CHECKING');
  });

  it('blocks drafts', () => {
    expect(derive({ isDraft: true })).toEqual({
      state: 'BLOCKED',
      blockers: ['DRAFT'],
      warnings: [],
    });
    expect(derive({ mergeStateStatus: 'DRAFT' }).blockers).toEqual(['DRAFT']);
  });

  it('explains BLOCKED with the reviews and checks that cause it', () => {
    expect(
      derive({
        mergeStateStatus: 'BLOCKED',
        reviewDecision: 'CHANGES_REQUESTED',
        checks: { failing: 2, pending: 1 },
      }),
    ).toEqual({
      state: 'BLOCKED',
      blockers: ['CHANGES_REQUESTED', 'CHECKS_FAILING', 'CHECKS_PENDING'],
      warnings: [],
    });
    expect(
      derive({ mergeStateStatus: 'BLOCKED', reviewDecision: 'REVIEW_REQUIRED' }).blockers,
    ).toEqual(['REVIEW_REQUIRED']);
  });

  it('falls back to OTHER when BLOCKED has no visible cause', () => {
    expect(derive({ mergeStateStatus: 'BLOCKED' }).blockers).toEqual(['OTHER']);
  });

  it('keeps BEHIND and UNSTABLE mergeable but warns', () => {
    expect(derive({ mergeStateStatus: 'BEHIND' })).toEqual({
      state: 'READY',
      blockers: [],
      warnings: ['BEHIND'],
    });
    expect(derive({ mergeStateStatus: 'UNSTABLE' })).toEqual({
      state: 'READY',
      blockers: [],
      warnings: ['CHECKS_FAILING'],
    });
  });

  it('ignores a review decision when GitHub does not block the merge', () => {
    expect(derive({ reviewDecision: 'REVIEW_REQUIRED' }).blockers).toEqual([]);
  });
});

describe('check tallies', () => {
  it('counts failing and unfinished check runs and status contexts', () => {
    expect(
      tallyChecks([
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'SKIPPED' },
        { status: 'COMPLETED', conclusion: 'FAILURE' },
        { status: 'COMPLETED', conclusion: 'TIMED_OUT' },
        { status: 'IN_PROGRESS', conclusion: '' },
        { status: 'QUEUED' },
        { state: 'SUCCESS' },
        { state: 'ERROR' },
        { state: 'PENDING' },
      ]),
    ).toEqual({ failing: 3, pending: 3 });
  });

  it('maps the rollup state of the list query', () => {
    expect(tallyRollupState('FAILURE')).toEqual({ failing: 1, pending: 0 });
    expect(tallyRollupState('PENDING')).toEqual({ failing: 0, pending: 1 });
    expect(tallyRollupState('SUCCESS')).toEqual({ failing: 0, pending: 0 });
    expect(tallyRollupState(null)).toEqual({ failing: 0, pending: 0 });
  });
});

describe('unrecognised GitHub values', () => {
  it('parse as UNKNOWN instead of throwing and yield the checking state', () => {
    const mergeable = GhMergeable.parse('SOMETHING_NEW');
    const mergeStateStatus = GhMergeStateStatus.parse('SOMETHING_NEW');
    expect([mergeable, mergeStateStatus]).toEqual(['UNKNOWN', 'UNKNOWN']);
    expect(
      deriveMergeReadiness({
        isDraft: false,
        mergeable,
        mergeStateStatus,
        reviewDecision: null,
        checks: { failing: 0, pending: 0 },
      }).state,
    ).toBe('CHECKING');
  });
});
