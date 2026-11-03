import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { UseQueryResult } from '@tanstack/react-query';
import type { PrSummary } from '@gepard/common';
import { Caption } from '../../../../components/Caption';
import { Inline } from '../../../../components/Layout';
import { Skeleton } from '../../../../components/Skeleton';
import { Surface } from '../../../../components/Surface';
import { usePrComments, usePrViewed } from '../../../../queries/comments';
import { usePrCommitList } from '../../../../queries/prs';
import { useOverviewPr } from '../../../../state/hooks';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { ProgressBar } from '../../../../components/ProgressBar';
import { LinkButton, Num } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';
import { useChangedFileList } from './useChangedFileList';
import { useViewedPaths } from './useViewedPaths';

const messages = defineMessages({
  commits: {
    id: 'content.overview.pr.commits',
    defaultMessage: '{count, plural, one {# commit} other {# commits}}',
  },
  comments: {
    id: 'content.overview.pr.comments',
    defaultMessage: '{total, plural, one {# comment} other {# comments}}',
  },
  unresolved: { id: 'content.overview.pr.unresolved', defaultMessage: ', {count} unresolved' },
  progress: { id: 'content.overview.pr.progress', defaultMessage: '{done}/{total} files viewed' },
  changesLabel: { id: 'content.overview.pr.facts.changes', defaultMessage: 'Changes' },
  filesLabel: { id: 'content.overview.pr.facts.files', defaultMessage: 'Files' },
  commitsLabel: { id: 'content.overview.pr.facts.commits', defaultMessage: 'Commits' },
  commentsLabel: { id: 'content.overview.pr.facts.comments', defaultMessage: 'Comments' },
  progressLabel: { id: 'content.overview.pr.facts.progress', defaultMessage: 'Review progress' },
});

const Box = styled(Surface).attrs({ $elevation: 'flat' })`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[5]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StatLabel = styled(Caption)`
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

function Fact({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Stat>
      <StatLabel>{label}</StatLabel>
      <div>{children}</div>
    </Stat>
  );
}

export function PrFacts({ prQuery }: { prQuery: UseQueryResult<PrSummary> }): React.JSX.Element {
  const actions = useOverviewActions();
  const { files, isPending: filesPending } = useChangedFileList();
  const overviewPr = useOverviewPr();
  const commitsQuery = usePrCommitList(overviewPr);
  const commentsQuery = usePrComments(overviewPr);
  const viewedQuery = usePrViewed(overviewPr);
  const commits = commitsQuery.data;
  const pr = prQuery.data;
  const threads = commentsQuery.data ?? [];
  const viewedPaths = useViewedPaths();

  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const viewedCount = files.filter((f) => viewedPaths.has(f.path)).length;
  const commentTotal = threads.reduce(
    (sum, t) => sum + t.comments.filter((c) => c.local?.status !== 'deleted').length,
    0,
  );
  const unresolved = threads.filter((t) => !t.isResolved && t.anchor.subjectType !== 'PR').length;

  return (
    <Box
      aria-busy={
        filesPending || commitsQuery.isPending || commentsQuery.isPending || viewedQuery.isPending
      }
    >
      <Fact label={<FormattedMessage {...messages.changesLabel} />}>
        {filesPending ? (
          <Skeleton width="96px" />
        ) : (
          <Lines additions={additions} deletions={deletions} />
        )}
      </Fact>
      <Fact label={<FormattedMessage {...messages.filesLabel} />}>
        {filesPending && prQuery.isPending ? (
          <Skeleton width="56px" />
        ) : (
          <FileCount files={files.length || (pr?.changedFiles ?? 0)} />
        )}
      </Fact>
      <Fact label={<FormattedMessage {...messages.commitsLabel} />}>
        {commitsQuery.isPending ? (
          <Skeleton width="72px" />
        ) : (
          <FormattedMessage {...messages.commits} values={{ count: commits?.length ?? 0 }} />
        )}
      </Fact>
      <Fact label={<FormattedMessage {...messages.commentsLabel} />}>
        {commentsQuery.isPending ? (
          <Skeleton width="128px" />
        ) : (
          <LinkButton onClick={actions.openComments}>
            <Num>
              <FormattedMessage {...messages.comments} values={{ total: commentTotal }} />
              <FormattedMessage {...messages.unresolved} values={{ count: unresolved }} />
            </Num>
          </LinkButton>
        )}
      </Fact>
      <Fact label={<FormattedMessage {...messages.progressLabel} />}>
        {filesPending || viewedQuery.isPending ? (
          <Skeleton width="160px" />
        ) : (
          <LinkButton onClick={actions.openFiles}>
            <Inline $gap={2}>
              <ProgressBar value={viewedCount} max={files.length} />
              <Num>
                <FormattedMessage
                  {...messages.progress}
                  values={{ done: viewedCount, total: files.length }}
                />
              </Num>
            </Inline>
          </LinkButton>
        )}
      </Fact>
    </Box>
  );
}
