import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { OverviewActivity, OverviewPr } from '@gepard/common';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Message } from '../../../components/Message';
import { useProjectOverview } from '../../../queries/overview';
import { useOverviewActions } from './useOverviewActions';
import {
  DecisionBadge,
  FileCount,
  Lines,
  Panel,
  ProgressBar,
  QueryState,
  RelativeTime,
  PrLabel,
} from './OverviewParts';
import {
  Grid,
  HeaderCell,
  LinkButton,
  Muted,
  Num,
  Page,
  PageBody,
  Truncated,
} from './overviewStyles';

const messages = defineMessages({
  title: { id: 'content.overview.project.title', defaultMessage: 'Open pull requests' },
  summaryOpen: {
    id: 'content.overview.project.summaryOpen',
    defaultMessage:
      '{open, plural, =0 {No open pull requests} one {# open pull request} other {# open pull requests}}',
  },
  summaryWaiting: {
    id: 'content.overview.project.summaryWaiting',
    defaultMessage: '{waiting} awaiting review',
  },
  summaryDrafts: {
    id: 'content.overview.project.summaryDrafts',
    defaultMessage: '{drafts, plural, one {# draft} other {# drafts}}',
  },
  separator: { id: 'content.overview.project.separator', defaultMessage: ' · ' },
  empty: { id: 'content.overview.project.empty', defaultMessage: 'No open pull requests.' },
  pr: { id: 'content.overview.project.pr', defaultMessage: 'Pull request' },
  size: { id: 'content.overview.project.size', defaultMessage: 'Size' },
  comments: { id: 'content.overview.project.comments', defaultMessage: 'Comments' },
  decision: { id: 'content.overview.project.decision', defaultMessage: 'Decision' },
  progress: { id: 'content.overview.project.progress', defaultMessage: 'Viewed' },
  updated: { id: 'content.overview.project.updated', defaultMessage: 'Updated' },
  review: { id: 'content.overview.project.review', defaultMessage: 'Review' },
  draft: { id: 'content.overview.project.draft', defaultMessage: 'draft' },
  commentCount: {
    id: 'content.overview.project.commentCount',
    defaultMessage: '{total} ({unresolved} unresolved)',
  },
  viewedCount: { id: 'content.overview.project.viewedCount', defaultMessage: '{done}/{total}' },
  authoredBy: { id: 'content.overview.project.authoredBy', defaultMessage: 'by {author}' },
  activity: { id: 'content.overview.project.activity', defaultMessage: 'Latest activity' },
  noActivity: { id: 'content.overview.project.noActivity', defaultMessage: 'No recent activity.' },
  activityCommit: {
    id: 'content.overview.activity.commit',
    defaultMessage: '{actor} pushed a commit to',
  },
  activityComment: {
    id: 'content.overview.activity.comment',
    defaultMessage: '{actor} commented on',
  },
  activityReview: {
    id: 'content.overview.activity.review',
    defaultMessage:
      '{actor} {state, select, APPROVED {approved} CHANGES_REQUESTED {requested changes on} DISMISSED {dismissed a review on} other {reviewed}}',
  },
  activityMerged: {
    id: 'content.overview.activity.merged',
    defaultMessage: '{actor} merged',
  },
  unknownActor: { id: 'content.overview.unknownActor', defaultMessage: 'Someone' },
});

const PR_COLUMNS = 'minmax(0, 1fr) 120px 150px 130px 100px 80px 70px';

const TitleCell = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ActivityRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

function PrRow({ pr }: { pr: OverviewPr }): React.JSX.Element {
  const actions = useOverviewActions();
  return (
    <>
      <TitleCell>
        <LinkButton onClick={() => actions.openPr(pr.number)}>
          <Truncated>
            <PrLabel number={pr.number} title={pr.title} />
            {pr.isDraft && (
              <Badge>
                <FormattedMessage {...messages.draft} />
              </Badge>
            )}
          </Truncated>
        </LinkButton>
        <Muted>
          <FormattedMessage {...messages.authoredBy} values={{ author: pr.author ?? '' }} />
        </Muted>
      </TitleCell>
      <div>
        <Lines additions={pr.additions} deletions={pr.deletions} />
        <br />
        <Muted>
          <FileCount files={pr.changedFiles} />
        </Muted>
      </div>
      <LinkButton onClick={() => actions.openPr(pr.number)}>
        <Num>
          <FormattedMessage
            {...messages.commentCount}
            values={{ total: pr.comments, unresolved: pr.unresolvedThreads }}
          />
        </Num>
      </LinkButton>
      <div>
        <DecisionBadge decision={pr.reviewDecision} />
      </div>
      <div>
        <ProgressBar done={pr.viewedFiles} total={pr.countedFiles} />
        <Muted>
          <FormattedMessage
            {...messages.viewedCount}
            values={{ done: pr.viewedFiles, total: pr.countedFiles }}
          />
        </Muted>
      </div>
      <RelativeTime value={pr.updatedAt} />
      <Button onClick={() => actions.reviewPr(pr.number)}>
        <FormattedMessage {...messages.review} />
      </Button>
    </>
  );
}

function ActivityLine({ entry }: { entry: OverviewActivity }): React.JSX.Element {
  const actions = useOverviewActions();
  const actor = entry.actor ?? <FormattedMessage {...messages.unknownActor} />;
  const verb =
    entry.kind === 'commit' ? (
      <FormattedMessage {...messages.activityCommit} values={{ actor }} />
    ) : entry.kind === 'comment' ? (
      <FormattedMessage {...messages.activityComment} values={{ actor }} />
    ) : entry.kind === 'merged' ? (
      <FormattedMessage {...messages.activityMerged} values={{ actor }} />
    ) : (
      <FormattedMessage
        {...messages.activityReview}
        values={{ actor, state: entry.reviewState ?? '' }}
      />
    );
  return (
    <ActivityRow>
      <span>{verb}</span>
      <LinkButton onClick={() => actions.openPr(entry.pr)}>
        <Truncated>
          <PrLabel number={entry.pr} title={entry.prTitle} />
        </Truncated>
      </LinkButton>
      <RelativeTime value={entry.at} />
    </ActivityRow>
  );
}

export function ProjectOverview(): React.JSX.Element {
  const { data, isLoading, error } = useProjectOverview();
  const prs = data?.prs ?? [];
  const waiting = prs.filter((p) => !p.isDraft && p.reviewDecision !== 'APPROVED').length;
  const drafts = prs.filter((p) => p.isDraft).length;

  return (
    <Page>
      <PageBody>
        <Panel title={<FormattedMessage {...messages.title} />}>
          <QueryState isLoading={isLoading} error={error} />
          {data && (
            <Muted>
              <FormattedMessage {...messages.summaryOpen} values={{ open: prs.length }} />
              <FormattedMessage {...messages.separator} />
              <FormattedMessage {...messages.summaryWaiting} values={{ waiting }} />
              <FormattedMessage {...messages.separator} />
              <FormattedMessage {...messages.summaryDrafts} values={{ drafts }} />
            </Muted>
          )}
          {data && prs.length === 0 && (
            <Message layout="inline">
              <FormattedMessage {...messages.empty} />
            </Message>
          )}
          {prs.length > 0 && (
            <Grid $columns={PR_COLUMNS}>
              <HeaderCell>
                <FormattedMessage {...messages.pr} />
              </HeaderCell>
              <HeaderCell>
                <FormattedMessage {...messages.size} />
              </HeaderCell>
              <HeaderCell>
                <FormattedMessage {...messages.comments} />
              </HeaderCell>
              <HeaderCell>
                <FormattedMessage {...messages.decision} />
              </HeaderCell>
              <HeaderCell>
                <FormattedMessage {...messages.progress} />
              </HeaderCell>
              <HeaderCell>
                <FormattedMessage {...messages.updated} />
              </HeaderCell>
              <span />
              {prs.map((pr) => (
                <PrRow key={pr.number} pr={pr} />
              ))}
            </Grid>
          )}
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
