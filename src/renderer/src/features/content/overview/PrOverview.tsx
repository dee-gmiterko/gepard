import { useMemo } from 'react';
import { defineMessages, FormattedDate, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { ArrowLeft } from 'react-feather';
import type { ChangedFile, PrOverviewDetails } from '@gepard/common';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Caption } from '../../../components/Caption';
import { Inline } from '../../../components/Layout';
import { Markdown } from '../../../components/Markdown';
import { Message } from '../../../components/Message';
import { useAppState } from '../../../state/AppContext';
import { useChangedFiles } from '../../../queries/files';
import { useComments, useViewed } from '../../../queries/comments';
import { useTargetedPr, usePrCommits } from '../../../queries/prs';
import { useCodeowners, usePrOverviewDetails } from '../../../queries/overview';
import {
  buildTimelineEvents,
  groupByExtension,
  groupByFolder,
  groupByOwner,
  groupTimeline,
  groupTimelineByDay,
  latestReviewStates,
  topChangedFiles,
  UNOWNED,
  NO_EXTENSION,
  type FileGroup,
  type TimelineGroup,
} from '../../../helpers/overview';
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
import { Grid, LinkButton, Muted, Num, Page, PageBody, Truncated } from './overviewStyles';

const messages = defineMessages({
  allPrs: { id: 'content.overview.pr.allPrs', defaultMessage: 'All pull requests' },
  review: { id: 'content.overview.pr.review', defaultMessage: 'Review' },
  stateOpen: { id: 'content.overview.pr.state.open', defaultMessage: 'Open' },
  stateDraft: { id: 'content.overview.pr.state.draft', defaultMessage: 'Draft' },
  stateMerged: { id: 'content.overview.pr.state.merged', defaultMessage: 'Merged' },
  stateClosed: { id: 'content.overview.pr.state.closed', defaultMessage: 'Closed' },
  byline: {
    id: 'content.overview.pr.byline',
    defaultMessage: '{author} wants to merge {head} into {base}',
  },
  commits: {
    id: 'content.overview.pr.commits',
    defaultMessage: '{count, plural, one {# commit} other {# commits}}',
  },
  comments: {
    id: 'content.overview.pr.comments',
    defaultMessage: '{total, plural, one {# comment} other {# comments}}',
  },
  unresolved: { id: 'content.overview.pr.unresolved', defaultMessage: ', {count} unresolved' },
  viewedMark: { id: 'content.overview.pr.viewedMark', defaultMessage: '✓ {path}' },
  progress: { id: 'content.overview.pr.progress', defaultMessage: '{done}/{total} files viewed' },
  folders: { id: 'content.overview.pr.folders', defaultMessage: 'Folders' },
  types: { id: 'content.overview.pr.types', defaultMessage: 'File types' },
  owners: { id: 'content.overview.pr.owners', defaultMessage: 'Code owners' },
  topFiles: { id: 'content.overview.pr.topFiles', defaultMessage: 'Top changed files' },
  rootFolder: { id: 'content.overview.pr.rootFolder', defaultMessage: '(root)' },
  noExtension: { id: 'content.overview.pr.noExtension', defaultMessage: '(no extension)' },
  unowned: { id: 'content.overview.pr.unowned', defaultMessage: 'Unowned' },
  reviewers: { id: 'content.overview.pr.reviewers', defaultMessage: 'Reviewers' },
  noReviewers: {
    id: 'content.overview.pr.noReviewers',
    defaultMessage: 'No reviews or requests yet.',
  },
  reviewState: {
    id: 'content.overview.pr.reviewState',
    defaultMessage:
      '{state, select, APPROVED {Approved} CHANGES_REQUESTED {Changes requested} DISMISSED {Dismissed} COMMENTED {Commented} other {Review}}',
  },
  requested: { id: 'content.overview.pr.requested', defaultMessage: 'Requested' },
  timeline: { id: 'content.overview.pr.timeline', defaultMessage: 'Timeline' },
  dayCommits: {
    id: 'content.overview.pr.dayCommits',
    defaultMessage: '{count, plural, one {# commit} other {# commits}}',
  },
  dayComments: {
    id: 'content.overview.pr.dayComments',
    defaultMessage: '{count, plural, one {# comment} other {# comments}}',
  },
  dayReviews: {
    id: 'content.overview.pr.dayReviews',
    defaultMessage: '{count, plural, one {# review} other {# reviews}}',
  },
  eventOpened: {
    id: 'content.overview.pr.event.opened',
    defaultMessage: '{actor} opened the pull request',
  },
  eventCommit: {
    id: 'content.overview.pr.event.commit',
    defaultMessage: '{actor} pushed {count, plural, one {# commit} other {# commits}}',
  },
  eventComment: {
    id: 'content.overview.pr.event.comment',
    defaultMessage: '{actor} wrote {count, plural, one {# comment} other {# comments}}',
  },
  eventReview: {
    id: 'content.overview.pr.event.review',
    defaultMessage:
      '{actor} {state, select, APPROVED {approved} CHANGES_REQUESTED {requested changes} DISMISSED {dismissed a review} other {reviewed}}',
  },
  eventMerged: { id: 'content.overview.pr.event.merged', defaultMessage: 'Merged' },
  eventClosed: { id: 'content.overview.pr.event.closed', defaultMessage: 'Closed' },
  someone: { id: 'content.overview.pr.someone', defaultMessage: 'Someone' },
  description: { id: 'content.overview.pr.description', defaultMessage: 'Description' },
  noDescription: {
    id: 'content.overview.pr.noDescription',
    defaultMessage: 'No description provided.',
  },
});

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.colors.fg};
`;

const Facts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[5]};
  align-items: center;
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: ${({ theme }) => theme.space[5]};
`;

const DayHeading = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: baseline;
  margin-top: ${({ theme }) => theme.space[2]};
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const EventRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: baseline;
  padding-left: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Description = styled.div`
  max-height: 160px;
  overflow: auto;
`;

const TOP_ROWS = 8;
const TOP_FILES = 5;

function GroupList({
  groups,
  label,
  onOpen,
}: {
  groups: FileGroup[];
  label: (key: string) => React.ReactNode;
  onOpen?: (key: string) => void;
}): React.JSX.Element {
  return (
    <Grid $columns="minmax(0, 1fr) auto auto">
      {groups.slice(0, TOP_ROWS).map((g) => (
        <GroupRow key={g.key} group={g} label={label} onOpen={onOpen} />
      ))}
    </Grid>
  );
}

function GroupRow({
  group,
  label,
  onOpen,
}: {
  group: FileGroup;
  label: (key: string) => React.ReactNode;
  onOpen?: (key: string) => void;
}): React.JSX.Element {
  const text = <Truncated>{label(group.key)}</Truncated>;
  return (
    <>
      {onOpen ? <LinkButton onClick={() => onOpen(group.key)}>{text}</LinkButton> : text}
      <Muted>
        <FileCount files={group.files} />
      </Muted>
      <Lines additions={group.additions} deletions={group.deletions} />
    </>
  );
}

function TimelineLine({ group }: { group: TimelineGroup }): React.JSX.Element {
  const actions = useOverviewActions();
  const actor = group.actor ?? <FormattedMessage {...messages.someone} />;
  const count = group.events.length;
  const reviewState = group.events[0].reviewState ?? '';
  let text: React.ReactNode;
  let onClick: (() => void) | null = null;
  switch (group.kind) {
    case 'opened':
      text = <FormattedMessage {...messages.eventOpened} values={{ actor }} />;
      break;
    case 'commit': {
      const sha = group.events.at(-1)?.sha;
      text = <FormattedMessage {...messages.eventCommit} values={{ actor, count }} />;
      if (sha) onClick = () => actions.openCommit(sha);
      break;
    }
    case 'comment':
      text = <FormattedMessage {...messages.eventComment} values={{ actor, count }} />;
      onClick = actions.openComments;
      break;
    case 'review':
      text = <FormattedMessage {...messages.eventReview} values={{ actor, state: reviewState }} />;
      onClick = actions.openComments;
      break;
    case 'merged':
      text = <FormattedMessage {...messages.eventMerged} />;
      break;
    case 'closed':
      text = <FormattedMessage {...messages.eventClosed} />;
      break;
  }
  return (
    <EventRow>
      <Caption>
        <FormattedDate value={group.at} timeStyle="short" />
      </Caption>
      {onClick ? <LinkButton onClick={onClick}>{text}</LinkButton> : <span>{text}</span>}
    </EventRow>
  );
}

function Reviewers({ details }: { details: PrOverviewDetails }): React.JSX.Element {
  const states = latestReviewStates(details.reviews);
  const reviewed = new Set(states.map((s) => s.author));
  const pending = details.reviewRequests.filter((r) => !reviewed.has(r));
  if (states.length === 0 && pending.length === 0) {
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.noReviewers} />
      </Message>
    );
  }
  return (
    <Grid $columns="minmax(0, 1fr) auto">
      {states.map((s) => (
        <ReviewerRow key={s.author} name={s.author}>
          <FormattedMessage {...messages.reviewState} values={{ state: s.state }} />
        </ReviewerRow>
      ))}
      {pending.map((name) => (
        <ReviewerRow key={`req-${name}`} name={name}>
          <FormattedMessage {...messages.requested} />
        </ReviewerRow>
      ))}
    </Grid>
  );
}

function ReviewerRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Truncated>{name}</Truncated>
      <Muted>{children}</Muted>
    </>
  );
}

function stateMessage(details: PrOverviewDetails | undefined): keyof typeof messages {
  if (!details) return 'stateOpen';
  if (details.state === 'MERGED') return 'stateMerged';
  if (details.state === 'CLOSED') return 'stateClosed';
  return details.isDraft ? 'stateDraft' : 'stateOpen';
}

export function PrOverview(): React.JSX.Element {
  const state = useAppState();
  const actions = useOverviewActions();
  const pr = useTargetedPr();
  const detailsQuery = usePrOverviewDetails();
  const details = detailsQuery.data;
  const changedQuery = useChangedFiles();
  const commits = usePrCommits().data;
  const threads = useComments().data;
  const viewed = useViewed().data;
  const owners = useCodeowners(state.checkout?.head).data ?? null;

  const files: readonly ChangedFile[] = useMemo(() => changedQuery.data ?? [], [changedQuery.data]);

  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const viewedCount = useMemo(() => {
    const done = new Set((viewed ?? []).filter((v) => v.viewed).map((v) => v.path));
    return files.filter((f) => done.has(f.path)).length;
  }, [files, viewed]);

  const commentTotals = useMemo(() => {
    let total = 0;
    let unresolved = 0;
    for (const t of threads ?? []) {
      total += t.comments.filter((c) => c.local?.status !== 'deleted').length;
      if (!t.isResolved && t.anchor.subjectType !== 'PR') unresolved += 1;
    }
    return { total, unresolved };
  }, [threads]);

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

  const folders = useMemo(() => groupByFolder(files), [files]);
  const types = useMemo(() => groupByExtension(files), [files]);
  const ownerGroups = useMemo(() => (owners ? groupByOwner(files, owners) : null), [files, owners]);
  const top = useMemo(() => topChangedFiles(files, TOP_FILES), [files]);

  const viewedPaths = useMemo(
    () => new Set((viewed ?? []).filter((v) => v.viewed).map((v) => v.path)),
    [viewed],
  );

  if (!pr) {
    return (
      <Page>
        <QueryState isLoading error={null} />
      </Page>
    );
  }

  return (
    <Page>
      <PageBody>
        <Header>
          <div>
            <LinkButton onClick={actions.showAllPrs}>
              <Inline $gap={1}>
                <ArrowLeft size={12} />
                <FormattedMessage {...messages.allPrs} />
              </Inline>
            </LinkButton>
          </div>
          <Inline>
            <Title>
              <PrLabel number={pr.number} title={pr.title} />
            </Title>
            <Badge>
              <FormattedMessage {...messages[stateMessage(details)]} />
            </Badge>
            <DecisionBadge decision={details?.reviewDecision ?? null} />
            <Button variant="primary" onClick={actions.openFiles}>
              <FormattedMessage {...messages.review} />
            </Button>
          </Inline>
          <Muted>
            <FormattedMessage
              {...messages.byline}
              values={{ author: pr.author.login, head: pr.headRefName, base: pr.baseRefName }}
            />
            {details && <RelativeTime value={details.updatedAt} />}
          </Muted>
          <QueryState isLoading={detailsQuery.isLoading} error={detailsQuery.error} />
        </Header>

        <Facts>
          <Inline $gap={2}>
            <Lines additions={additions} deletions={deletions} />
            <Muted>
              <FileCount files={files.length || pr.changedFiles} />
            </Muted>
          </Inline>
          <Muted>
            <FormattedMessage {...messages.commits} values={{ count: commits?.length ?? 0 }} />
          </Muted>
          <LinkButton onClick={actions.openComments}>
            <Num>
              <FormattedMessage {...messages.comments} values={{ total: commentTotals.total }} />
              <FormattedMessage
                {...messages.unresolved}
                values={{ count: commentTotals.unresolved }}
              />
            </Num>
          </LinkButton>
          <LinkButton onClick={actions.openFiles}>
            <Inline $gap={2}>
              <ProgressBar done={viewedCount} total={files.length} />
              <Num>
                <FormattedMessage
                  {...messages.progress}
                  values={{ done: viewedCount, total: files.length }}
                />
              </Num>
            </Inline>
          </LinkButton>
        </Facts>

        {files.length === 0 ? (
          <QueryState
            isLoading={changedQuery.isLoading || !state.checkout}
            error={changedQuery.error}
          />
        ) : (
          <Columns>
            <Panel title={<FormattedMessage {...messages.folders} />}>
              <GroupList
                groups={folders}
                label={(key) => key || <FormattedMessage {...messages.rootFolder} />}
                onOpen={(key) => {
                  if (key) actions.openFolder(key);
                }}
              />
            </Panel>
            <Panel title={<FormattedMessage {...messages.types} />}>
              <GroupList
                groups={types}
                label={(key) =>
                  key === NO_EXTENSION ? <FormattedMessage {...messages.noExtension} /> : key
                }
              />
            </Panel>
            {ownerGroups && (
              <Panel title={<FormattedMessage {...messages.owners} />}>
                <GroupList
                  groups={ownerGroups}
                  label={(key) =>
                    key === UNOWNED ? <FormattedMessage {...messages.unowned} /> : key
                  }
                />
              </Panel>
            )}
            <Panel title={<FormattedMessage {...messages.topFiles} />}>
              <Grid $columns="minmax(0, 1fr) auto">
                {top.map((f) => (
                  <TopFileRow
                    key={f.path}
                    file={f}
                    viewed={viewedPaths.has(f.path)}
                    onOpen={actions.openFile}
                  />
                ))}
              </Grid>
            </Panel>
          </Columns>
        )}

        {details && (
          <Panel title={<FormattedMessage {...messages.reviewers} />}>
            <Reviewers details={details} />
          </Panel>
        )}

        <Panel title={<FormattedMessage {...messages.timeline} />}>
          {days.map((day) => (
            <div key={day.day}>
              <DayHeading>
                <FormattedDate value={day.day} dateStyle="medium" timeZone="UTC" />
                <Muted>
                  {day.counts.commit > 0 && (
                    <FormattedMessage
                      {...messages.dayCommits}
                      values={{ count: day.counts.commit }}
                    />
                  )}
                  {day.counts.comment > 0 && (
                    <FormattedMessage
                      {...messages.dayComments}
                      values={{ count: day.counts.comment }}
                    />
                  )}
                  {day.counts.review > 0 && (
                    <FormattedMessage
                      {...messages.dayReviews}
                      values={{ count: day.counts.review }}
                    />
                  )}
                </Muted>
              </DayHeading>
              {day.groups.map((group) => (
                <TimelineLine key={`${group.kind}-${group.at}-${group.actor}`} group={group} />
              ))}
            </div>
          ))}
        </Panel>

        {details && (
          <Panel title={<FormattedMessage {...messages.description} />}>
            {details.body.trim() ? (
              <Description>
                <Markdown>{details.body}</Markdown>
              </Description>
            ) : (
              <Muted>
                <FormattedMessage {...messages.noDescription} />
              </Muted>
            )}
          </Panel>
        )}
      </PageBody>
    </Page>
  );
}

function TopFileRow({
  file,
  viewed,
  onOpen,
}: {
  file: ChangedFile;
  viewed: boolean;
  onOpen: (path: string) => void;
}): React.JSX.Element {
  return (
    <>
      <LinkButton onClick={() => onOpen(file.path)} title={file.path}>
        <Truncated>
          {viewed ? (
            <FormattedMessage {...messages.viewedMark} values={{ path: file.path }} />
          ) : (
            file.path
          )}
        </Truncated>
      </LinkButton>
      <Lines additions={file.additions} deletions={file.deletions} />
    </>
  );
}
