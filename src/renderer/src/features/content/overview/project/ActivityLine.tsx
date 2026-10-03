import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { OverviewActivity } from '@gepard/common';
import { useOverviewActions } from '../shared/useOverviewActions';
import { PrLabel } from '../shared/PrLabel';
import { RelativeTime } from '../shared/RelativeTime';
import { LinkButton, Truncated } from '../shared/overviewStyles';

const messages = defineMessages({
  commit: {
    id: 'content.overview.activity.commit',
    defaultMessage: '{actor} pushed a commit to',
  },
  comment: {
    id: 'content.overview.activity.comment',
    defaultMessage: '{actor} commented on',
  },
  review: {
    id: 'content.overview.activity.review',
    defaultMessage:
      '{actor} {state, select, APPROVED {approved} CHANGES_REQUESTED {requested changes on} DISMISSED {dismissed a review on} other {reviewed}}',
  },
  merged: {
    id: 'content.overview.activity.merged',
    defaultMessage: '{actor} merged',
  },
  unknownActor: { id: 'content.overview.unknownActor', defaultMessage: 'Someone' },
});

const Row = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

function describeActivity(entry: OverviewActivity): React.ReactNode {
  const actor = entry.actor ?? <FormattedMessage {...messages.unknownActor} />;
  switch (entry.kind) {
    case 'commit':
      return <FormattedMessage {...messages.commit} values={{ actor }} />;
    case 'comment':
      return <FormattedMessage {...messages.comment} values={{ actor }} />;
    case 'merged':
      return <FormattedMessage {...messages.merged} values={{ actor }} />;
    case 'review':
      return (
        <FormattedMessage {...messages.review} values={{ actor, state: entry.reviewState ?? '' }} />
      );
  }
}

export function ActivityLine({ entry }: { entry: OverviewActivity }): React.JSX.Element {
  const actions = useOverviewActions();
  return (
    <Row>
      <span>{describeActivity(entry)}</span>
      <LinkButton onClick={() => actions.openPr(entry.pr)}>
        <Truncated>
          <PrLabel number={entry.pr} title={entry.prTitle} />
        </Truncated>
      </LinkButton>
      <RelativeTime value={entry.at} />
    </Row>
  );
}
