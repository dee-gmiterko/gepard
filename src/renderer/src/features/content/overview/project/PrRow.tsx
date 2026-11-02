import { defineMessages, FormattedMessage } from 'react-intl';
import { prHeadLabel, type OverviewPr } from '@gepard/common';
import styled from 'styled-components';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Inline } from '../../../../components/Layout';
import { useOverviewActions } from '../shared/useOverviewActions';
import { DecisionBadge } from '../shared/DecisionBadge';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { ForkBadge } from '../shared/ForkBadge';
import { canMerge } from '../shared/mergeReadiness';
import { MergeButton } from '../shared/MergeButton';
import { PrLabel } from '../shared/PrLabel';
import { ProgressBar } from '../../../../components/ProgressBar';
import { RelativeTime } from '../shared/RelativeTime';
import { Cell, LinkButton, Muted, Num, RowGrid, WideOnly } from '../shared/overviewStyles';

const messages = defineMessages({
  review: { id: 'content.overview.project.review', defaultMessage: 'Review' },
  draft: { id: 'content.overview.project.draft', defaultMessage: 'draft' },
  merged: { id: 'content.overview.project.merged', defaultMessage: 'merged' },
  closed: { id: 'content.overview.project.closed', defaultMessage: 'closed' },
  commentCount: {
    id: 'content.overview.project.commentCount',
    defaultMessage: '{total} ({unresolved} unresolved)',
  },
  viewedCount: { id: 'content.overview.project.viewedCount', defaultMessage: '{done}/{total}' },
  authoredBy: { id: 'content.overview.project.authoredBy', defaultMessage: 'by {author}' },
});

const TitleLine = styled(Inline)`
  align-self: stretch;

  > :not(:first-child) {
    flex-shrink: 0;
  }
`;

export function PrRow({ pr }: { pr: OverviewPr }): React.JSX.Element {
  const actions = useOverviewActions();
  const fullyViewed = pr.countedFiles > 0 && pr.viewedFiles >= pr.countedFiles;
  const mergeIsNextStep =
    pr.state === 'OPEN' && !pr.isDraft && canMerge(pr.mergeReadiness) && fullyViewed;
  return (
    <RowGrid>
      <Cell>
        <TitleLine $gap={2}>
          <LinkButton title={pr.title} onClick={() => actions.openPr(pr.number)}>
            <PrLabel number={pr.number} title={pr.title} />
          </LinkButton>
          {pr.state === 'OPEN' && pr.isDraft && (
            <Badge>
              <FormattedMessage {...messages.draft} />
            </Badge>
          )}
          {pr.state === 'MERGED' && (
            <Badge $tone="success">
              <FormattedMessage {...messages.merged} />
            </Badge>
          )}
          {pr.state === 'CLOSED' && (
            <Badge>
              <FormattedMessage {...messages.closed} />
            </Badge>
          )}
          {pr.isCrossRepository && <ForkBadge head={prHeadLabel(pr)} />}
          <DecisionBadge decision={pr.reviewDecision} />
        </TitleLine>
        <Muted>
          <FormattedMessage {...messages.authoredBy} values={{ author: pr.author ?? '' }} />
        </Muted>
      </Cell>
      <Cell>
        <Lines additions={pr.additions} deletions={pr.deletions} />
        <Muted>
          <FileCount files={pr.changedFiles} />
        </Muted>
      </Cell>
      <WideOnly>
        <LinkButton onClick={() => actions.openPr(pr.number)}>
          <Num>
            <FormattedMessage
              {...messages.commentCount}
              values={{ total: pr.comments, unresolved: pr.unresolvedThreads }}
            />
          </Num>
        </LinkButton>
      </WideOnly>
      <WideOnly>
        <Cell>
          <ProgressBar value={pr.viewedFiles} max={pr.countedFiles} />
          <Muted>
            <FormattedMessage
              {...messages.viewedCount}
              values={{ done: pr.viewedFiles, total: pr.countedFiles }}
            />
          </Muted>
        </Cell>
      </WideOnly>
      <WideOnly>
        <RelativeTime value={pr.updatedAt} />
      </WideOnly>
      <Inline $gap={2}>
        {pr.state === 'OPEN' && !pr.isDraft && (
          <MergeButton
            pr={pr.number}
            title={pr.title}
            head={prHeadLabel(pr)}
            base={pr.baseRefName}
            mergeReadiness={pr.mergeReadiness}
            viewedFiles={pr.viewedFiles}
            totalFiles={pr.countedFiles}
            prominent={mergeIsNextStep}
          />
        )}
        <Button
          variant={mergeIsNextStep ? 'secondary' : 'primary'}
          onClick={() => actions.reviewPr(pr.number)}
        >
          <FormattedMessage {...messages.review} />
        </Button>
      </Inline>
    </RowGrid>
  );
}
