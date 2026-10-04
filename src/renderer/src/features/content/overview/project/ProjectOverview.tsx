import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { OverviewPr, ProjectOverview as ProjectOverviewData } from '@gepard/common';
import { List } from '../../../../components/List';
import { Message } from '../../../../components/Message';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { useProjectOverview } from '../../../../queries/overview';
import { Panel } from '../shared/Panel';
import { QueryState } from '../shared/QueryState';
import { Page, PageBody } from '../shared/overviewStyles';
import { ActivityLine } from './ActivityLine';
import { PrTable } from './PrTable';
import { ProjectSummary } from './ProjectSummary';

const messages = defineMessages({
  title: { id: 'content.overview.project.title', defaultMessage: 'Pull requests' },
  tabsLabel: { id: 'content.overview.project.tabs', defaultMessage: 'Pull request state' },
  tabAwaiting: {
    id: 'content.overview.project.tab.awaiting',
    defaultMessage: 'Open awaiting ({count})',
  },
  tabReviewed: {
    id: 'content.overview.project.tab.reviewed',
    defaultMessage: 'Open reviewed ({count})',
  },
  tabClosed: { id: 'content.overview.project.tab.closed', defaultMessage: 'Closed ({count})' },
  emptyAwaiting: {
    id: 'content.overview.project.empty.awaiting',
    defaultMessage: 'No open pull requests awaiting review.',
  },
  emptyReviewed: {
    id: 'content.overview.project.empty.reviewed',
    defaultMessage: 'No reviewed open pull requests.',
  },
  emptyClosed: {
    id: 'content.overview.project.empty.closed',
    defaultMessage: 'No closed pull requests.',
  },
  activity: { id: 'content.overview.project.activity', defaultMessage: 'Latest activity' },
  noActivity: { id: 'content.overview.project.noActivity', defaultMessage: 'No recent activity.' },
});

type PrTab = 'awaiting' | 'reviewed' | 'closed';

const TABS: Record<
  PrTab,
  {
    label: MessageDescriptor;
    empty: MessageDescriptor;
    select: (data: ProjectOverviewData) => OverviewPr[];
  }
> = {
  awaiting: {
    label: messages.tabAwaiting,
    empty: messages.emptyAwaiting,
    select: (data) => data.prs.filter((p) => !p.reviewed),
  },
  reviewed: {
    label: messages.tabReviewed,
    empty: messages.emptyReviewed,
    select: (data) => data.prs.filter((p) => p.reviewed),
  },
  closed: {
    label: messages.tabClosed,
    empty: messages.emptyClosed,
    select: (data) => data.closedPrs,
  },
};

const TAB_ORDER: readonly PrTab[] = ['awaiting', 'reviewed', 'closed'];

export function ProjectOverview(): React.JSX.Element {
  const intl = useIntl();
  const { data, isLoading, error } = useProjectOverview();
  const [tab, setTab] = useState<PrTab>('awaiting');
  const prs = data ? TABS[tab].select(data) : [];

  return (
    <Page>
      <PageBody>
        <Panel
          title={<FormattedMessage {...messages.title} />}
          actions={
            data && (
              <SegmentedControl
                label={intl.formatMessage(messages.tabsLabel)}
                value={tab}
                options={TAB_ORDER.map((key) => ({
                  value: key,
                  label: (
                    <FormattedMessage
                      {...TABS[key].label}
                      values={{ count: TABS[key].select(data).length }}
                    />
                  ),
                }))}
                onChange={setTab}
              />
            )
          }
        >
          <QueryState isLoading={isLoading} error={error} />
          {data && <ProjectSummary prs={data.prs} />}
          {data && prs.length === 0 && (
            <Message layout="inline">
              <FormattedMessage {...TABS[tab].empty} />
            </Message>
          )}
          {prs.length > 0 && <PrTable prs={prs} />}
        </Panel>
        {data && (
          <Panel title={<FormattedMessage {...messages.activity} />}>
            {data.activity.length === 0 ? (
              <Message layout="inline">
                <FormattedMessage {...messages.noActivity} />
              </Message>
            ) : (
              <List>
                {data.activity.map((entry) => (
                  <ActivityLine key={`${entry.kind}-${entry.pr}-${entry.at}`} entry={entry} />
                ))}
              </List>
            )}
          </Panel>
        )}
      </PageBody>
    </Page>
  );
}
