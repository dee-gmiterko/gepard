import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { Inline } from '../../../../components/Layout';
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

const Count = styled(Muted)`
  font-weight: 400;
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const Heading = styled(Inline)`
  padding-bottom: ${({ theme }) => theme.space[1]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Line = styled.ul`
  margin: ${({ theme }) => theme.space[2]} 0 0 ${({ theme }) => theme.space[2]};
  padding: 0;
  list-style: none;
`;

export function TimelineDay({ day }: { day: Day }): React.JSX.Element {
  return (
    <div>
      <Heading $gap={2}>
        <FormattedDate value={day.day} dateStyle="medium" timeZone="UTC" />
        <Inline $gap={2}>
          {day.counts.commit > 0 && (
            <Count>
              <FormattedMessage {...messages.commits} values={{ count: day.counts.commit }} />
            </Count>
          )}
          {day.counts.comment > 0 && (
            <Count>
              <FormattedMessage {...messages.comments} values={{ count: day.counts.comment }} />
            </Count>
          )}
          {day.counts.review > 0 && (
            <Count>
              <FormattedMessage {...messages.reviews} values={{ count: day.counts.review }} />
            </Count>
          )}
        </Inline>
      </Heading>
      <Line>
        {day.groups.map((group, i) => (
          <TimelineLine key={`${group.kind}-${group.at}-${group.actor}-${i}`} group={group} />
        ))}
      </Line>
    </div>
  );
}
