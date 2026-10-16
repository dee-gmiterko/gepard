import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { ArrowLeft } from 'react-feather';
import type { UseQueryResult } from '@tanstack/react-query';
import { prHeadLabel, type PrOverviewDetails, type PrSummary } from '@gepard/common';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Inline, Stack } from '../../../../components/Layout';
import { Skeleton } from '../../../../components/Skeleton';
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

function stateMessage(details: PrOverviewDetails): keyof typeof messages {
  if (details.state === 'MERGED') return 'stateMerged';
  if (details.state === 'CLOSED') return 'stateClosed';
  return details.isDraft ? 'stateDraft' : 'stateOpen';
}

export function PrHeader({
  prQuery,
  detailsQuery,
}: {
  prQuery: UseQueryResult<PrSummary>;
  detailsQuery: UseQueryResult<PrOverviewDetails>;
}): React.JSX.Element {
  const { data: pr } = prQuery;
  const { data: details } = detailsQuery;
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
          {prQuery.isPending ? (
            <Skeleton width="50%" height="1.2em" />
          ) : (
            pr && <PrLabel number={pr.number} title={pr.title} truncate={false} />
          )}
        </Title>
        {detailsQuery.isPending ? (
          <Skeleton width="56px" height="1.2em" />
        ) : (
          details && (
            <Badge>
              <FormattedMessage {...messages[stateMessage(details)]} />
            </Badge>
          )
        )}
        {pr?.isCrossRepository && <ForkBadge head={prHeadLabel(pr)} />}
        <DecisionBadge decision={details?.reviewDecision ?? null} />
        <Button variant="primary" onClick={actions.openFiles}>
          <FormattedMessage {...messages.review} />
        </Button>
        <SyncButton />
      </HeaderRow>
      <Inline $gap={2}>
        {prQuery.isPending ? (
          <Skeleton width="280px" />
        ) : (
          pr && (
            <Muted>
              <FormattedMessage
                {...messages.byline}
                values={{ author: pr.author.login, head: prHeadLabel(pr), base: pr.baseRefName }}
              />
            </Muted>
          )
        )}
        {detailsQuery.isPending ? (
          <Skeleton width="72px" />
        ) : (
          details && <RelativeTime value={details.updatedAt} />
        )}
      </Inline>
      <QueryState isLoading={false} error={prQuery.error ?? detailsQuery.error} />
    </Stack>
  );
}
