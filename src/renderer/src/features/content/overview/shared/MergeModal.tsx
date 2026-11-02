import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { MergeMethod, type ReviewDecision } from '@gepard/common';
import { Button } from '../../../../components/Button';
import { ActionRow, Stack } from '../../../../components/Layout';
import { Message } from '../../../../components/Message';
import { Modal } from '../../../../components/Modal';
import { Select } from '../../../../components/Select';
import { formatDescribedError } from '../../../../errors/errorMessage';
import { useMergePr } from '../../../../queries/prs';
import { PrLabel } from './PrLabel';

const messages = defineMessages({
  title: { id: 'content.overview.merge.title', defaultMessage: 'Merge pull request' },
  close: { id: 'content.overview.merge.close', defaultMessage: 'Close' },
  method: { id: 'content.overview.merge.method', defaultMessage: 'Merge method' },
  merge: { id: 'content.overview.merge.method.merge', defaultMessage: 'Create a merge commit' },
  squash: { id: 'content.overview.merge.method.squash', defaultMessage: 'Squash and merge' },
  rebase: { id: 'content.overview.merge.method.rebase', defaultMessage: 'Rebase and merge' },
  cancel: { id: 'content.overview.merge.cancel', defaultMessage: 'Cancel' },
  needsChanges: {
    id: 'content.overview.merge.warning.changesRequested',
    defaultMessage: 'Changes have been requested on this pull request.',
  },
  needsReview: {
    id: 'content.overview.merge.warning.reviewRequired',
    defaultMessage: 'This pull request has not been approved yet.',
  },
  merging: { id: 'content.overview.merge.merging', defaultMessage: 'Merging…' },
  confirm: { id: 'content.overview.merge.confirm', defaultMessage: 'Merge' },
});

const METHOD_LABELS = {
  MERGE: messages.merge,
  SQUASH: messages.squash,
  REBASE: messages.rebase,
} as const satisfies Record<MergeMethod, unknown>;

const METHODS = MergeMethod.options;

function toMergeMethod(value: string): MergeMethod {
  return METHODS.find((m) => m === value) ?? 'MERGE';
}

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Subject = styled.div`
  font-weight: 600;
  overflow-wrap: anywhere;
`;

const Actions = styled(ActionRow)`
  margin-top: ${({ theme }) => theme.space[4]};
`;

export function MergeModal({
  pr,
  title,
  reviewDecision,
  onClose,
}: {
  pr: number;
  title: string;
  reviewDecision: ReviewDecision | null;
  onClose: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const merge = useMergePr();
  const [method, setMethod] = useState<MergeMethod>('MERGE');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (merge.isPending) return;
    merge.mutate({ pr, method }, { onSuccess: onClose });
  }

  return (
    <Modal
      title={<FormattedMessage {...messages.title} />}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Subject>
          <PrLabel number={pr} title={title} truncate={false} />
        </Subject>
        <Field>
          <FormattedMessage {...messages.method} />
          <Select
            value={method}
            onChange={(e) => setMethod(toMergeMethod(e.target.value))}
            disabled={merge.isPending}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {intl.formatMessage(METHOD_LABELS[m])}
              </option>
            ))}
          </Select>
        </Field>
        {reviewDecision === 'CHANGES_REQUESTED' && (
          <Message tone="warning" layout="inline">
            <FormattedMessage {...messages.needsChanges} />
          </Message>
        )}
        {reviewDecision === 'REVIEW_REQUIRED' && (
          <Message tone="warning" layout="inline">
            <FormattedMessage {...messages.needsReview} />
          </Message>
        )}
        {merge.isError && (
          <Message tone="danger" layout="inline">
            {formatDescribedError(intl, merge.error)}
          </Message>
        )}
      </Stack>
      <Actions>
        <Button type="button" onClick={onClose}>
          <FormattedMessage {...messages.cancel} />
        </Button>
        <Button type="submit" variant="primary" disabled={merge.isPending}>
          <FormattedMessage {...(merge.isPending ? messages.merging : messages.confirm)} />
        </Button>
      </Actions>
    </Modal>
  );
}
