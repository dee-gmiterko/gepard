import { useState } from 'react';
import type { ReviewDecision } from '@gepard/common';
import { defineMessages, FormattedMessage } from 'react-intl';
import { Button } from '../../../../components/Button';
import { MergeModal } from './MergeModal';

const messages = defineMessages({
  merge: { id: 'content.overview.merge.open', defaultMessage: 'Merge' },
});

export function MergeButton({
  pr,
  title,
  reviewDecision,
}: {
  pr: number;
  title: string;
  reviewDecision: ReviewDecision | null;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FormattedMessage {...messages.merge} />
      </Button>
      {open && (
        <MergeModal
          pr={pr}
          title={title}
          reviewDecision={reviewDecision}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
