import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { Caption } from '../../../../components/Caption';
import type { Theme } from '../../../../theme/tokens';
import type { TimelineGroup, TimelineKind } from '../../../../helpers/overview';
import { LinkButton } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';

const messages = defineMessages({
  opened: {
    id: 'content.overview.pr.event.opened',
    defaultMessage: '{actor} opened the pull request',
  },
  commitFallback: { id: 'content.overview.pr.event.commit', defaultMessage: 'Commit' },
  comment: { id: 'content.overview.pr.event.comment', defaultMessage: '{actor} commented' },
  commentCount: {
    id: 'content.overview.pr.event.commentCount',
    defaultMessage: '{count, plural, one {# comment} other {# comments}}',
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

const DOT_SIZE = 9;

const DOT_CENTER = ({ theme }: { theme: Theme }): string => `calc(${theme.space[1]} + 0.5lh)`;

const Item = styled.li`
  position: relative;
  padding: ${({ theme }) => theme.space[1]} 0 ${({ theme }) => theme.space[1]}
    ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -1px;
    width: 1px;
    background: ${({ theme }) => theme.colors.border};
  }

  &:first-child::before {
    top: ${DOT_CENTER};
  }

  &:last-child::before {
    bottom: calc(100% - ${DOT_CENTER});
  }
`;

const Dot = styled.span<{ $kind: TimelineKind }>`
  position: absolute;
  top: calc(${DOT_CENTER} - ${DOT_SIZE / 2}px);
  left: -${DOT_SIZE / 2 + 0.5}px;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  box-sizing: border-box;
  border: 2px solid ${({ theme }) => theme.colors.bg};
  border-radius: 50%;
  background: ${({ theme, $kind }) =>
    $kind === 'merged'
      ? theme.colors.success
      : $kind === 'closed'
        ? theme.colors.danger
        : $kind === 'commit'
          ? theme.colors.accent
          : theme.colors.fgSubtle};
`;

const Text = styled.div`
  overflow-wrap: anywhere;
`;

const Meta = styled(Caption)`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.space[2]};
`;

export function TimelineLine({ group }: { group: TimelineGroup }): React.JSX.Element {
  const actions = useOverviewActions();
  const actor = group.actor ?? <FormattedMessage {...messages.someone} />;
  const first = group.events[0];
  const count = group.events.length;
  let text: React.ReactNode;
  let onClick: (() => void) | null = null;
  switch (group.kind) {
    case 'opened':
      text = <FormattedMessage {...messages.opened} values={{ actor }} />;
      break;
    case 'commit': {
      const { sha } = first;
      text = first.headline ?? <FormattedMessage {...messages.commitFallback} />;
      if (sha) onClick = () => actions.openCommit(sha);
      break;
    }
    case 'comment':
      text = <FormattedMessage {...messages.comment} values={{ actor }} />;
      onClick = actions.openComments;
      break;
    case 'review':
      text = (
        <FormattedMessage {...messages.review} values={{ actor, state: first.reviewState ?? '' }} />
      );
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
    <Item>
      <Dot $kind={group.kind} aria-hidden />
      <Text>{onClick ? <LinkButton onClick={onClick}>{text}</LinkButton> : text}</Text>
      <Meta>
        {group.kind === 'commit' && <span>{actor}</span>}
        <FormattedDate value={group.at} timeStyle="short" />
        {group.kind === 'comment' && count > 1 && (
          <FormattedMessage {...messages.commentCount} values={{ count }} />
        )}
      </Meta>
    </Item>
  );
}
