import { useState } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { MergeReadiness } from '@gepard/common';
import { Button } from '../../../../components/Button';
import { canMerge, useMergeBlockedReason } from './mergeReadiness';
import { MergeModal } from './MergeModal';

const messages = defineMessages({
  merge: { id: 'content.overview.merge.open', defaultMessage: 'Merge' },
});

export function MergeButton({
  pr,
  title,
  head,
  base,
  mergeReadiness,
  viewedFiles,
  totalFiles,
}: {
  pr: number;
  title: string;
  head: string;
  base: string;
  mergeReadiness: MergeReadiness;
  viewedFiles: number;
  totalFiles: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const blockedReason = useMergeBlockedReason(mergeReadiness);
  return (
    <>
      <Button
        disabled={!canMerge(mergeReadiness)}
        title={blockedReason}
        onClick={() => setOpen(true)}
      >
        <FormattedMessage {...messages.merge} />
      </Button>
      {open && (
        <MergeModal
          pr={pr}
          title={title}
          head={head}
          base={base}
          mergeReadiness={mergeReadiness}
          viewedFiles={viewedFiles}
          totalFiles={totalFiles}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
