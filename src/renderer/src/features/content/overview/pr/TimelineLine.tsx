import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { Caption } from '../../../../components/Caption';
import type { TimelineGroup } from '../../../../helpers/overview';
import { LinkButton } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';

const messages = defineMessages({
  opened: {
    id: 'content.overview.pr.event.opened',
    defaultMessage: '{actor} opened the pull request',
  },
  commit: {
    id: 'content.overview.pr.event.commit',
    defaultMessage: '{actor} pushed {count, plural, one {# commit} other {# commits}}',
  },
  comment: {
    id: 'content.overview.pr.event.comment',
    defaultMessage: '{actor} wrote {count, plural, one {# comment} other {# comments}}',
  },
  review: {
    id: 'content.overview.pr.event.review',
    defaultMessage:
      '{actor} {state, select, APPROVED {approved} CHANGES_REQUESTED {requested changes} DISMISSED {dismissed a review} other {reviewed}}',
  },
  merged: { id: 'content.overview.pr.event.merged', defaultMessage: 'Merged' },
  closed: { id: 'content.overview.pr.event.closed', defaultMessage: 'Closed' },
  someone: { id: 'content.overview.pr.someone', defaultMessage: 'Someone' },
});

const Time = styled(Caption)`
  min-width: 56px;
  font-variant-numeric: tabular-nums;
`;

const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};
  align-items: baseline;
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export function TimelineLine({ group }: { group: TimelineGroup }): React.JSX.Element {
  const actions = useOverviewActions();
  const actor = group.actor ?? <FormattedMessage {...messages.someone} />;
  const count = group.events.length;
  const reviewState = group.events[0].reviewState ?? '';
  let text: React.ReactNode;
  let onClick: (() => void) | null = null;
  switch (group.kind) {
    case 'opened':
      text = <FormattedMessage {...messages.opened} values={{ actor }} />;
      break;
    case 'commit': {
      const sha = group.events.at(-1)?.sha;
      text = <FormattedMessage {...messages.commit} values={{ actor, count }} />;
      if (sha) onClick = () => actions.openCommit(sha);
      break;
    }
    case 'comment':
      text = <FormattedMessage {...messages.comment} values={{ actor, count }} />;
      onClick = actions.openComments;
      break;
    case 'review':
      text = <FormattedMessage {...messages.review} values={{ actor, state: reviewState }} />;
      onClick = actions.openComments;
      break;
    case 'merged':
      text = <FormattedMessage {...messages.merged} />;
      break;
    case 'closed':
      text = <FormattedMessage {...messages.closed} />;
      break;
  }
  return (
    <Row>
      <Time>
        <FormattedDate value={group.at} timeStyle="short" />
      </Time>
      {onClick ? <LinkButton onClick={onClick}>{text}</LinkButton> : <span>{text}</span>}
    </Row>
  );
}
