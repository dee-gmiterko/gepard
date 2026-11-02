import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { MergeMethod, MergeReadiness } from '@gepard/common';
import { Button } from '../../../../components/Button';
import { Stack } from '../../../../components/Layout';
import { Message } from '../../../../components/Message';
import { Select } from '../../../../components/Select';
import { formatDescribedError } from '../../../../errors/errorMessage';
import { canMerge } from './mergeReadiness';
import { METHOD_LABELS, toMergeMethod } from './mergeMethods';
import { Actions, Subject } from './mergeStyles';
import { MergeStatus } from './MergeStatus';
import { Muted } from './overviewStyles';
import { PrLabel } from './PrLabel';

const messages = defineMessages({
  branches: {
    id: 'content.overview.merge.branches',
    defaultMessage: '{head} into {base}',
  },
  method: { id: 'content.overview.merge.method', defaultMessage: 'Merge method' },
  cancel: { id: 'content.overview.merge.cancel', defaultMessage: 'Cancel' },
  merging: { id: 'content.overview.merge.merging', defaultMessage: 'Merging…' },
  confirm: { id: 'content.overview.merge.confirm', defaultMessage: 'Merge' },
});

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

export function MergeFormStep({
  pr,
  title,
  head,
  base,
  method,
  offered,
  mergeReadiness,
  isPending,
  error,
  onMethodChange,
  onCancel,
}: {
  pr: number;
  title: string;
  head: string;
  base: string;
  method: MergeMethod;
  offered: readonly MergeMethod[];
  mergeReadiness: MergeReadiness;
  isPending: boolean;
  error: Error | null;
  onMethodChange: (method: MergeMethod) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <>
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
            onChange={(e) => onMethodChange(toMergeMethod(e.target.value))}
            disabled={isPending}
          >
            {offered.map((m) => (
              <option key={m} value={m}>
                {intl.formatMessage(METHOD_LABELS[m])}
              </option>
            ))}
          </Select>
        </Field>
        <MergeStatus readiness={mergeReadiness} />
        {error && (
          <Message tone="danger" layout="inline">
            {formatDescribedError(intl, error)}
          </Message>
        )}
      </Stack>
      <Actions>
        <Button type="button" onClick={onCancel}>
          <FormattedMessage {...messages.cancel} />
        </Button>
        <Button type="submit" variant="primary" disabled={isPending || !canMerge(mergeReadiness)}>
          <FormattedMessage {...(isPending ? messages.merging : messages.confirm)} />
        </Button>
      </Actions>
    </>
  );
}
