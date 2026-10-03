import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { ArrowLeft } from 'react-feather';
import type { PrOverviewDetails, PrSummary } from '@gepard/common';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Inline } from '../../../../components/Layout';
import { SyncButton } from '../../sync/SyncButton';
import { DecisionBadge } from '../shared/DecisionBadge';
import { PrLabel } from '../shared/PrLabel';
import { QueryState } from '../shared/QueryState';
import { RelativeTime } from '../shared/RelativeTime';
import { LinkButton, Muted } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';

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
});

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.colors.fg};
`;

function stateMessage(details: PrOverviewDetails | undefined): keyof typeof messages {
  if (!details) return 'stateOpen';
  if (details.state === 'MERGED') return 'stateMerged';
  if (details.state === 'CLOSED') return 'stateClosed';
  return details.isDraft ? 'stateDraft' : 'stateOpen';
}

export function PrHeader({
  pr,
  details,
  isLoading,
  error,
}: {
  pr: PrSummary;
  details: PrOverviewDetails | undefined;
  isLoading: boolean;
  error: Error | null;
}): React.JSX.Element {
  const actions = useOverviewActions();
  return (
    <Column>
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
        <SyncButton />
      </Inline>
      <Muted>
        <FormattedMessage
          {...messages.byline}
          values={{ author: pr.author.login, head: pr.headRefName, base: pr.baseRefName }}
        />
        {details && <RelativeTime value={details.updatedAt} />}
      </Muted>
      <QueryState isLoading={isLoading} error={error} />
    </Column>
  );
}
