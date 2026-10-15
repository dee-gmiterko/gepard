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
import { SkeletonRows } from '../shared/SkeletonRows';
import { TimelineDay } from './TimelineDay';

const messages = defineMessages({
  title: { id: 'content.overview.pr.timeline', defaultMessage: 'Timeline' },
});

export function TimelinePanel({
  pr,
  details,
}: {
  pr: PrSummary | null;
  details: PrOverviewDetails | undefined;
}): React.JSX.Element {
  const commitsQuery = usePrCommits();
  const commentsQuery = useComments();
  const commits = commitsQuery.data;
  const threads = commentsQuery.data;
  const isLoading = !pr || commitsQuery.isLoading || commentsQuery.isLoading || !details;
  const days = useMemo(
    () =>
      pr
        ? groupTimelineByDay(
            groupTimeline(
              buildTimelineEvents({
                author: pr.author.login,
                createdAt: pr.createdAt,
                commits: commits ?? [],
                threads: threads ?? [],
                details: details ?? null,
              }),
            ),
          )
        : [],
    [pr, commits, threads, details],
  );
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <Stack $gap={4} aria-busy={isLoading}>
        {days.map((day) => (
          <TimelineDay key={day.day} day={day} />
        ))}
        {isLoading && <SkeletonRows rows={3} />}
      </Stack>
    </Panel>
  );
}
