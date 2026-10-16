import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { UseQueryResult } from '@tanstack/react-query';
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
import { PanelBody } from '../shared/PanelBody';
import { TimelineDay } from './TimelineDay';

const messages = defineMessages({
  title: { id: 'content.overview.pr.timeline', defaultMessage: 'Timeline' },
});

export function TimelinePanel({
  prQuery,
  detailsQuery,
}: {
  prQuery: UseQueryResult<PrSummary>;
  detailsQuery: UseQueryResult<PrOverviewDetails>;
}): React.JSX.Element {
  const commitsQuery = usePrCommits();
  const commentsQuery = useComments();
  const pr = prQuery.data;
  const commits = commitsQuery.data;
  const threads = commentsQuery.data;
  const details = detailsQuery.data;
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
  const isPending =
    prQuery.isPending ||
    detailsQuery.isPending ||
    commitsQuery.isPending ||
    commentsQuery.isPending;
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <PanelBody isPending={isPending} rows={3}>
        <Stack $gap={4}>
          {days.map((day) => (
            <TimelineDay key={day.day} day={day} />
          ))}
        </Stack>
      </PanelBody>
    </Panel>
  );
}
