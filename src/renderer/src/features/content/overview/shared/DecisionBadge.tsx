import { defineMessages, FormattedMessage, type MessageDescriptor } from 'react-intl';
import type { ReviewDecision } from '@gepard/common';
import { Badge, type BadgeTone } from '../../../../components/Badge';

const messages = defineMessages({
  approved: { id: 'content.overview.decision.approved', defaultMessage: 'Approved' },
  changesRequested: {
    id: 'content.overview.decision.changesRequested',
    defaultMessage: 'Changes requested',
  },
  reviewRequired: {
    id: 'content.overview.decision.reviewRequired',
    defaultMessage: 'Review required',
  },
});

const DECISION: Record<ReviewDecision, { descriptor: MessageDescriptor; tone: BadgeTone }> = {
  APPROVED: { descriptor: messages.approved, tone: 'success' },
  CHANGES_REQUESTED: { descriptor: messages.changesRequested, tone: 'warning' },
  REVIEW_REQUIRED: { descriptor: messages.reviewRequired, tone: 'muted' },
};

export function DecisionBadge({
  decision,
}: {
  decision: ReviewDecision | null;
}): React.JSX.Element | null {
  if (!decision) return null;
  const { descriptor, tone } = DECISION[decision];
  return (
    <Badge $tone={tone}>
      <FormattedMessage {...descriptor} />
    </Badge>
  );
}
