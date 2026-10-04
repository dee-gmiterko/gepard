import { defineMessages, FormattedMessage } from 'react-intl';
import type { OverviewPr } from '@gepard/common';
import styled from 'styled-components';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Inline } from '../../../../components/Layout';
import { useOverviewActions } from '../shared/useOverviewActions';
import { DecisionBadge } from '../shared/DecisionBadge';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { PrLabel } from '../shared/PrLabel';
import { ProgressBar } from '../../../../components/ProgressBar';
import { RelativeTime } from '../shared/RelativeTime';
import { Cell, LinkButton, Muted, Num, RowGrid } from '../shared/overviewStyles';

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

/** Fills the cell so a long title ellipsizes while the state badges keep their size. */
const TitleLine = styled(Inline)`
  align-self: stretch;

  > :not(:first-child) {
    flex-shrink: 0;
  }
`;

export function PrRow({ pr }: { pr: OverviewPr }): React.JSX.Element {
  const actions = useOverviewActions();
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
      <LinkButton onClick={() => actions.openPr(pr.number)}>
        <Num>
          <FormattedMessage
            {...messages.commentCount}
            values={{ total: pr.comments, unresolved: pr.unresolvedThreads }}
          />
        </Num>
      </LinkButton>
      <Cell>
        <ProgressBar value={pr.viewedFiles} max={pr.countedFiles} />
        <Muted>
          <FormattedMessage
            {...messages.viewedCount}
            values={{ done: pr.viewedFiles, total: pr.countedFiles }}
          />
        </Muted>
      </Cell>
      <RelativeTime value={pr.updatedAt} />
      <Button onClick={() => actions.reviewPr(pr.number)}>
        <FormattedMessage {...messages.review} />
      </Button>
    </RowGrid>
  );
}
