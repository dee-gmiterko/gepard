import { defineMessages, FormattedMessage } from 'react-intl';
import type { UseQueryResult } from '@tanstack/react-query';
import type { PrOverviewDetails } from '@gepard/common';
import { Message } from '../../../../components/Message';
import { latestReviewStates } from '../../../../helpers/overview';
import { Panel } from '../shared/Panel';
import { PanelBody } from '../shared/PanelBody';
import { Table } from '../shared/overviewStyles';
import { ReviewerRow } from './ReviewerRow';

const messages = defineMessages({
  title: { id: 'content.overview.pr.reviewers', defaultMessage: 'Reviewers' },
  none: {
    id: 'content.overview.pr.noReviewers',
    defaultMessage: 'No reviews or requests yet.',
  },
  reviewState: {
    id: 'content.overview.pr.reviewState',
    defaultMessage:
      '{state, select, APPROVED {Approved} CHANGES_REQUESTED {Changes requested} DISMISSED {Dismissed} COMMENTED {Commented} other {Review}}',
  },
  requested: { id: 'content.overview.pr.requested', defaultMessage: 'Requested' },
});

function ReviewersTable({ details }: { details: PrOverviewDetails }): React.JSX.Element {
  const states = latestReviewStates(details.reviews);
  const reviewed = new Set(states.map((s) => s.author));
  const pending = details.reviewRequests.filter((r) => !reviewed.has(r));
  if (states.length === 0 && pending.length === 0) {
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.none} />
      </Message>
    );
  }
  return (
    <Table>
      {states.map((s) => (
        <ReviewerRow key={s.author} name={s.author}>
          <FormattedMessage {...messages.reviewState} values={{ state: s.state }} />
        </ReviewerRow>
      ))}
      {pending.map((name) => (
        <ReviewerRow key={`req-${name}`} name={name}>
          <FormattedMessage {...messages.requested} />
        </ReviewerRow>
      ))}
    </Table>
  );
}

export function ReviewersPanel({
  detailsQuery,
}: {
  detailsQuery: UseQueryResult<PrOverviewDetails>;
}): React.JSX.Element {
  const { data, isPending, error } = detailsQuery;
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <PanelBody isPending={isPending} error={error} rows={2}>
        {data && <ReviewersTable details={data} />}
      </PanelBody>
    </Panel>
  );
}
