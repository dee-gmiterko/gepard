import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { ArrowLeft } from 'react-feather';
import { prHeadLabel, type PrOverviewDetails, type PrSummary } from '@gepard/common';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Inline, Stack } from '../../../../components/Layout';
import { SyncButton } from '../../sync/SyncButton';
import { DecisionBadge } from '../shared/DecisionBadge';
import { ForkBadge } from '../shared/ForkBadge';
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

const Title = styled.h1`
  flex: 1;
  min-width: 0;
  margin: 0;
  font-weight: 600;
  font-size: ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.colors.fg};
`;

const HeaderRow = styled(Inline)`
  align-self: stretch;
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
    <Stack $gap={2} $align="flex-start">
      <div>
        <LinkButton onClick={actions.showAllPrs}>
          <Inline $gap={1}>
            <ArrowLeft size={12} />
            <FormattedMessage {...messages.allPrs} />
          </Inline>
        </LinkButton>
      </div>
      <HeaderRow>
        <Title>
          <PrLabel number={pr.number} title={pr.title} truncate={false} />
        </Title>
        <Badge>
          <FormattedMessage {...messages[stateMessage(details)]} />
        </Badge>
        {pr.isCrossRepository && <ForkBadge head={prHeadLabel(pr)} />}
        <DecisionBadge decision={details?.reviewDecision ?? null} />
        <Button variant="primary" onClick={actions.openFiles}>
          <FormattedMessage {...messages.review} />
        </Button>
        <SyncButton />
      </HeaderRow>
      <Inline $gap={2}>
        <Muted>
          <FormattedMessage
            {...messages.byline}
            values={{ author: pr.author.login, head: prHeadLabel(pr), base: pr.baseRefName }}
          />
        </Muted>
        {details && <RelativeTime value={details.updatedAt} />}
      </Inline>
      <QueryState isLoading={isLoading} error={error} />
    </Stack>
  );
}
