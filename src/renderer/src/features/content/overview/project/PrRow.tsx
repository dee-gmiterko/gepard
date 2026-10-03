import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import type { OverviewPr } from '@gepard/common';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { useOverviewActions } from '../shared/useOverviewActions';
import { DecisionBadge } from '../shared/DecisionBadge';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { PrLabel } from '../shared/PrLabel';
import { ProgressBar } from '../shared/ProgressBar';
import { RelativeTime } from '../shared/RelativeTime';
import { LinkButton, Muted, Num, Truncated } from '../shared/overviewStyles';

const messages = defineMessages({
  review: { id: 'content.overview.project.review', defaultMessage: 'Review' },
  draft: { id: 'content.overview.project.draft', defaultMessage: 'draft' },
  commentCount: {
    id: 'content.overview.project.commentCount',
    defaultMessage: '{total} ({unresolved} unresolved)',
  },
  viewedCount: { id: 'content.overview.project.viewedCount', defaultMessage: '{done}/{total}' },
  authoredBy: { id: 'content.overview.project.authoredBy', defaultMessage: 'by {author}' },
});

const TitleCell = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export function PrRow({ pr }: { pr: OverviewPr }): React.JSX.Element {
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
