import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import type { MergeBlocker, MergeReadiness, MergeWarning } from '@gepard/common';

export const mergeMessages = defineMessages({
  ready: { id: 'content.overview.merge.status.ready', defaultMessage: 'Ready to merge.' },
  checking: {
    id: 'content.overview.merge.status.checking',
    defaultMessage: 'Checking whether this pull request can be merged…',
  },
  conflicting: {
    id: 'content.overview.merge.status.conflicting',
    defaultMessage:
      'This pull request has conflicts that must be resolved before it can be merged.',
  },
  blocked: {
    id: 'content.overview.merge.status.blocked',
    defaultMessage: 'Merging is blocked:',
  },
  draft: { id: 'content.overview.merge.blocker.draft', defaultMessage: 'It is a draft.' },
  changesRequested: {
    id: 'content.overview.merge.blocker.changesRequested',
    defaultMessage: 'Changes have been requested.',
  },
  reviewRequired: {
    id: 'content.overview.merge.blocker.reviewRequired',
    defaultMessage: 'A required review is missing.',
  },
  checksFailing: {
    id: 'content.overview.merge.blocker.checksFailing',
    defaultMessage: 'Some checks are failing.',
  },
  checksPending: {
    id: 'content.overview.merge.blocker.checksPending',
    defaultMessage: 'Some checks are still running.',
  },
  other: {
    id: 'content.overview.merge.blocker.other',
    defaultMessage: 'The branch protection rules are not satisfied.',
  },
  behind: {
    id: 'content.overview.merge.warning.behind',
    defaultMessage: 'The branch is behind its base branch.',
  },
  unstable: {
    id: 'content.overview.merge.warning.unstable',
    defaultMessage: 'Some checks that are not required are failing.',
  },
});

const BLOCKERS = {
  DRAFT: mergeMessages.draft,
  CHANGES_REQUESTED: mergeMessages.changesRequested,
  REVIEW_REQUIRED: mergeMessages.reviewRequired,
  CHECKS_FAILING: mergeMessages.checksFailing,
  CHECKS_PENDING: mergeMessages.checksPending,
  OTHER: mergeMessages.other,
} as const satisfies Record<MergeBlocker, unknown>;

const WARNINGS = {
  BEHIND: mergeMessages.behind,
  CHECKS_FAILING: mergeMessages.unstable,
} as const satisfies Record<MergeWarning, unknown>;

export function canMerge(readiness: MergeReadiness): boolean {
  return readiness.state === 'READY' || readiness.state === 'CHECKING';
}

export function blockerTexts(intl: IntlShape, readiness: MergeReadiness): string[] {
  return readiness.blockers.map((b) => intl.formatMessage(BLOCKERS[b]));
}

export function warningTexts(intl: IntlShape, readiness: MergeReadiness): string[] {
  return readiness.warnings.map((w) => intl.formatMessage(WARNINGS[w]));
}

export function useMergeBlockedReason(readiness: MergeReadiness): string | undefined {
  const intl = useIntl();
  if (readiness.state === 'CONFLICTING') return intl.formatMessage(mergeMessages.conflicting);
  if (readiness.state !== 'BLOCKED') return undefined;
  return [intl.formatMessage(mergeMessages.blocked), ...blockerTexts(intl, readiness)].join(' ');
}
