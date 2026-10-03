import { useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { ReviewDecision } from '@gepard/common';
import { Badge, type BadgeTone } from '../../../components/Badge';
import { Caption } from '../../../components/Caption';
import { SectionHeading } from '../../../components/SectionHeading';
import { Add, Del, Num } from './overviewStyles';
import { Message } from '../../../components/Message';

const messages = defineMessages({
  approved: { id: 'content.overview.decision.approved', defaultMessage: 'Approved' },
  changesRequested: {
    id: 'content.overview.decision.changesRequested',
    defaultMessage: 'Changes requested',
  },
  reviewRequired: {
    id: 'content.overview.decision.reviewRequired',
    defaultMessage: 'Review required',
  },
  size: {
    id: 'content.overview.size',
    defaultMessage: '{files, plural, one {# file} other {# files}}',
  },
  added: { id: 'content.overview.added', defaultMessage: '+{count}' },
  removed: { id: 'content.overview.removed', defaultMessage: '−{count}' },
  prLabel: { id: 'content.overview.prLabel', defaultMessage: '#{number} {title}' },
  loading: { id: 'content.overview.loading', defaultMessage: 'Loading…' },
  failed: { id: 'content.overview.failed', defaultMessage: 'Could not load: {message}' },
});

export function Lines({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}): React.JSX.Element {
  return (
    <Num>
      <Add>
        <FormattedMessage {...messages.added} values={{ count: additions }} />
      </Add>
      <Del>
        <FormattedMessage {...messages.removed} values={{ count: deletions }} />
      </Del>
    </Num>
  );
}

export function FileCount({ files }: { files: number }): React.JSX.Element {
  return <FormattedMessage {...messages.size} values={{ files }} />;
}

const Track = styled.span`
  display: inline-block;
  width: 64px;
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled.span<{ $percent: number }>`
  display: block;
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.success};
`;

export function ProgressBar({ done, total }: { done: number; total: number }): React.JSX.Element {
  return (
    <Track>
      <Fill $percent={total > 0 ? Math.round((done / total) * 100) : 0} />
    </Track>
  );
}

const DECISION: Record<ReviewDecision, { descriptor: MessageDescriptor; tone: BadgeTone }> = {
  APPROVED: { descriptor: messages.approved, tone: 'success' },
  CHANGES_REQUESTED: { descriptor: messages.changesRequested, tone: 'warning' },
  REVIEW_REQUIRED: { descriptor: messages.reviewRequired, tone: 'muted' },
};

export function DecisionBadge({
  decision,
}: {
  decision: ReviewDecision | null;
}): React.JSX.Element | null {
  if (!decision) return null;
  const { descriptor, tone } = DECISION[decision];
  return (
    <Badge $tone={tone}>
      <FormattedMessage {...descriptor} />
    </Badge>
  );
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function RelativeTime({ value }: { value: string }): React.JSX.Element {
  const intl = useIntl();
  const [now] = useState(() => Date.now());
  const diff = Date.parse(value) - now;
  const [unit, size] = UNITS.find(([, ms]) => Math.abs(diff) >= ms) ?? UNITS[UNITS.length - 1];
  return (
    <Caption title={intl.formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })}>
      {intl.formatRelativeTime(Math.round(diff / size), unit)}
    </Caption>
  );
}

const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
`;

export function Panel({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Block>
      <SectionHeading title={title} actions={actions} />
      {children}
    </Block>
  );
}

export function QueryState({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: Error | null;
}): React.JSX.Element | null {
  if (error) {
    return (
      <Message tone="danger" layout="inline">
        <FormattedMessage {...messages.failed} values={{ message: error.message }} />
      </Message>
    );
  }
  if (isLoading) {
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  }
  return null;
}

export function PrLabel({ number, title }: { number: number; title: string }): React.JSX.Element {
  return <FormattedMessage {...messages.prLabel} values={{ number, title }} />;
}
