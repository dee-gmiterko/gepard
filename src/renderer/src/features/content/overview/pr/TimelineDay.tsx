import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { TimelineDay as Day } from '../../../../helpers/overview';
import { Muted } from '../shared/overviewStyles';
import { TimelineLine } from './TimelineLine';

const messages = defineMessages({
  commits: {
    id: 'content.overview.pr.dayCommits',
    defaultMessage: '{count, plural, one {# commit} other {# commits}}',
  },
  comments: {
    id: 'content.overview.pr.dayComments',
    defaultMessage: '{count, plural, one {# comment} other {# comments}}',
  },
  reviews: {
    id: 'content.overview.pr.dayReviews',
    defaultMessage: '{count, plural, one {# review} other {# reviews}}',
  },
});

const Heading = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: baseline;
  margin-top: ${({ theme }) => theme.space[2]};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export function TimelineDay({ day }: { day: Day }): React.JSX.Element {
  return (
    <div>
      <Heading>
        <FormattedDate value={day.day} dateStyle="medium" timeZone="UTC" />
        <Muted>
          {day.counts.commit > 0 && (
            <FormattedMessage {...messages.commits} values={{ count: day.counts.commit }} />
          )}
          {day.counts.comment > 0 && (
            <FormattedMessage {...messages.comments} values={{ count: day.counts.comment }} />
          )}
          {day.counts.review > 0 && (
            <FormattedMessage {...messages.reviews} values={{ count: day.counts.review }} />
          )}
        </Muted>
      </Heading>
      {day.groups.map((group) => (
        <TimelineLine key={`${group.kind}-${group.at}-${group.actor}`} group={group} />
      ))}
    </div>
  );
}
