import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { PrSummary } from '@gepard/common';
import { Inline } from '../../../../components/Layout';
import { Surface } from '../../../../components/Surface';
import { useComments } from '../../../../queries/comments';
import { usePrCommits } from '../../../../queries/prs';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { ProgressBar } from '../../../../components/ProgressBar';
import { LinkButton, Muted, Num } from '../shared/overviewStyles';
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
});

const Box = styled(Surface).attrs({ $elevation: 'flat' })`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[5]};
  align-items: center;
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export function PrFacts({ pr }: { pr: PrSummary }): React.JSX.Element {
  const actions = useOverviewActions();
  const { files } = useChangedFileList();
  const commits = usePrCommits().data;
  const threads = useComments().data ?? [];
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
    <Box>
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
          <FormattedMessage {...messages.comments} values={{ total: commentTotal }} />
          <FormattedMessage {...messages.unresolved} values={{ count: unresolved }} />
        </Num>
      </LinkButton>
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
    </Box>
  );
}
