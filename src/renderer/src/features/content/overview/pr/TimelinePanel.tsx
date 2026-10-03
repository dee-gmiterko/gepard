import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { PrOverviewDetails, PrSummary } from '@gepard/common';
import { Stack } from '../../../../components/Layout';
import { useComments } from '../../../../queries/comments';
import { usePrCommits } from '../../../../queries/prs';
import {
  buildTimelineEvents,
  groupTimeline,
  groupTimelineByDay,
} from '../../../../helpers/overview';
import { Panel } from '../shared/Panel';
import { TimelineDay } from './TimelineDay';

const messages = defineMessages({
  title: { id: 'content.overview.pr.timeline', defaultMessage: 'Timeline' },
});

export function TimelinePanel({
  pr,
  details,
}: {
  pr: PrSummary;
  details: PrOverviewDetails | undefined;
}): React.JSX.Element {
  const commits = usePrCommits().data;
  const threads = useComments().data;
  const days = useMemo(
    () =>
      groupTimelineByDay(
        groupTimeline(
          buildTimelineEvents({
            author: pr.author.login,
            createdAt: pr.createdAt,
            commits: commits ?? [],
            threads: threads ?? [],
            details: details ?? null,
          }),
        ),
      ),
    [pr, commits, threads, details],
  );
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <Stack $gap={4}>
        {days.map((day) => (
          <TimelineDay key={day.day} day={day} />
        ))}
      </Stack>
    </Panel>
  );
}
