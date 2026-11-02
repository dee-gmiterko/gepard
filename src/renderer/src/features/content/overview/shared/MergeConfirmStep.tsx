import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Button } from '../../../../components/Button';
import { Stack } from '../../../../components/Layout';
import { Message } from '../../../../components/Message';
import { formatDescribedError } from '../../../../errors/errorMessage';
import { Actions, Subject } from './mergeStyles';
import { PrLabel } from './PrLabel';

const messages = defineMessages({
  unviewed: {
    id: 'content.overview.merge.unviewed',
    defaultMessage: '{count} of {total} files are not marked as viewed.',
  },
  back: { id: 'content.overview.merge.back', defaultMessage: 'Back' },
  mergeAnyway: { id: 'content.overview.merge.anyway', defaultMessage: 'Merge anyway' },
  merging: { id: 'content.overview.merge.merging', defaultMessage: 'Merging…' },
});

export function MergeConfirmStep({
  pr,
  title,
  unviewed,
  totalFiles,
  canConfirm,
  isPending,
  error,
  onBack,
}: {
  pr: number;
  title: string;
  unviewed: number;
  totalFiles: number;
  canConfirm: boolean;
  isPending: boolean;
  error: Error | null;
  onBack: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <>
      <Stack>
        <Subject>
          <PrLabel number={pr} title={title} truncate={false} />
        </Subject>
        <Message tone="warning" layout="inline">
          <FormattedMessage
            {...messages.unviewed}
            values={{ count: unviewed, total: totalFiles }}
          />
        </Message>
        {error && (
          <Message tone="danger" layout="inline">
            {formatDescribedError(intl, error)}
          </Message>
        )}
      </Stack>
      <Actions>
        <Button type="button" disabled={isPending} onClick={onBack}>
          <FormattedMessage {...messages.back} />
        </Button>
        <Button type="submit" variant="primary" autoFocus disabled={isPending || !canConfirm}>
          <FormattedMessage {...(isPending ? messages.merging : messages.mergeAnyway)} />
        </Button>
      </Actions>
    </>
  );
}
