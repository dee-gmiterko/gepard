import { useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { MergeMethod, type AllowedMergeMethods, type MergeReadiness } from '@gepard/common';
import { Button } from '../../../../components/Button';
import { ActionRow, Stack } from '../../../../components/Layout';
import { Message } from '../../../../components/Message';
import { Modal } from '../../../../components/Modal';
import { Select } from '../../../../components/Select';
import { formatDescribedError } from '../../../../errors/errorMessage';
import { useAllowedMergeMethods, useMergePr } from '../../../../queries/prs';
import { blockerTexts, canMerge, mergeMessages, warningTexts } from './mergeReadiness';
import { Muted } from './overviewStyles';
import { PrLabel } from './PrLabel';

const messages = defineMessages({
  title: { id: 'content.overview.merge.title', defaultMessage: 'Merge pull request' },
  close: { id: 'content.overview.merge.close', defaultMessage: 'Close' },
  branches: {
    id: 'content.overview.merge.branches',
    defaultMessage: '{head} into {base}',
  },
  method: { id: 'content.overview.merge.method', defaultMessage: 'Merge method' },
  merge: { id: 'content.overview.merge.method.merge', defaultMessage: 'Create a merge commit' },
  squash: { id: 'content.overview.merge.method.squash', defaultMessage: 'Squash and merge' },
  rebase: { id: 'content.overview.merge.method.rebase', defaultMessage: 'Rebase and merge' },
  cancel: { id: 'content.overview.merge.cancel', defaultMessage: 'Cancel' },
  merging: { id: 'content.overview.merge.merging', defaultMessage: 'Merging…' },
  confirm: { id: 'content.overview.merge.confirm', defaultMessage: 'Merge' },
});

const METHOD_LABELS = {
  MERGE: messages.merge,
  SQUASH: messages.squash,
  REBASE: messages.rebase,
} as const satisfies Record<MergeMethod, unknown>;

const METHODS = MergeMethod.options;
const ALLOWED_KEYS = {
  MERGE: 'merge',
  SQUASH: 'squash',
  REBASE: 'rebase',
} as const satisfies Record<MergeMethod, keyof AllowedMergeMethods>;
const DEFAULT_ORDER: readonly MergeMethod[] = ['MERGE', 'SQUASH', 'REBASE'];

function offeredMethods(allowed: AllowedMergeMethods | undefined): readonly MergeMethod[] {
  if (!allowed) return METHODS;
  const offered = METHODS.filter((m) => allowed[ALLOWED_KEYS[m]]);
  return offered.length > 0 ? offered : METHODS;
}

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

function MergeStatus({ readiness }: { readiness: MergeReadiness }): React.JSX.Element {
  const intl = useIntl();
  const warnings = warningTexts(intl, readiness).map((text) => (
    <Message key={text} tone="warning" layout="inline">
      {text}
    </Message>
  ));
  if (readiness.state === 'CHECKING') {
    return (
      <Message tone="subtle" layout="inline">
        <FormattedMessage {...mergeMessages.checking} />
      </Message>
    );
  }
  if (readiness.state === 'CONFLICTING') {
    return (
      <Message tone="danger" layout="inline">
        <FormattedMessage {...mergeMessages.conflicting} />
      </Message>
    );
  }
  if (readiness.state === 'BLOCKED') {
    return (
      <Stack $gap={1}>
        <Message tone="danger" layout="inline">
          <FormattedMessage {...mergeMessages.blocked} />
        </Message>
        {blockerTexts(intl, readiness).map((text) => (
          <Message key={text} tone="danger" layout="inline">
            {text}
          </Message>
        ))}
      </Stack>
    );
  }
  return (
    <Stack $gap={1}>
      <Message layout="inline">
        <FormattedMessage {...mergeMessages.ready} />
      </Message>
      {warnings}
    </Stack>
  );
}

export function MergeModal({
  pr,
  title,
  head,
  base,
  mergeReadiness,
  onClose,
}: {
  pr: number;
  title: string;
  head: string;
  base: string;
  mergeReadiness: MergeReadiness;
  onClose: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const merge = useMergePr();
  const allowed = useAllowedMergeMethods();
  const offered = offeredMethods(allowed.data);
  const [chosen, setChosen] = useState<MergeMethod | null>(null);
  const method =
    chosen && offered.includes(chosen)
      ? chosen
      : (DEFAULT_ORDER.find((m) => offered.includes(m)) ?? 'MERGE');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (merge.isPending || !canMerge(mergeReadiness)) return;
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
        <Muted>
          <FormattedMessage {...messages.branches} values={{ head, base }} />
        </Muted>
        <Field>
          <FormattedMessage {...messages.method} />
          <Select
            value={method}
            onChange={(e) => setChosen(toMergeMethod(e.target.value))}
            disabled={merge.isPending}
          >
            {offered.map((m) => (
              <option key={m} value={m}>
                {intl.formatMessage(METHOD_LABELS[m])}
              </option>
            ))}
          </Select>
        </Field>
        <MergeStatus readiness={mergeReadiness} />
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
        <Button
          type="submit"
          variant="primary"
          disabled={merge.isPending || !canMerge(mergeReadiness)}
        >
          <FormattedMessage {...(merge.isPending ? messages.merging : messages.confirm)} />
        </Button>
      </Actions>
    </Modal>
  );
}
