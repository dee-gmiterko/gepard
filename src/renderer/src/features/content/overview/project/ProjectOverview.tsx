import { defineMessages, FormattedMessage } from 'react-intl';
import { Message } from '../../../../components/Message';
import { useProjectOverview } from '../../../../queries/overview';
import { Panel } from '../shared/Panel';
import { QueryState } from '../shared/QueryState';
import { Page, PageBody } from '../shared/overviewStyles';
import { ActivityLine } from './ActivityLine';
import { PrTable } from './PrTable';
import { ProjectSummary } from './ProjectSummary';

const messages = defineMessages({
  title: { id: 'content.overview.project.title', defaultMessage: 'Open pull requests' },
  empty: { id: 'content.overview.project.empty', defaultMessage: 'No open pull requests.' },
  activity: { id: 'content.overview.project.activity', defaultMessage: 'Latest activity' },
  noActivity: { id: 'content.overview.project.noActivity', defaultMessage: 'No recent activity.' },
});

export function ProjectOverview(): React.JSX.Element {
  const { data, isLoading, error } = useProjectOverview();
  const prs = data?.prs ?? [];

  return (
    <Page>
      <PageBody>
        <Panel title={<FormattedMessage {...messages.title} />}>
          <QueryState isLoading={isLoading} error={error} />
          {data && <ProjectSummary prs={prs} />}
          {data && prs.length === 0 && (
            <Message layout="inline">
              <FormattedMessage {...messages.empty} />
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
              data.activity.map((entry) => (
                <ActivityLine key={`${entry.kind}-${entry.pr}-${entry.at}`} entry={entry} />
              ))
            )}
          </Panel>
        )}
      </PageBody>
    </Page>
  );
}
