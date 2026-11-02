import { useState, type FormEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { MergeMethod, MergeReadiness } from '@gepard/common';
import { Modal } from '../../../../components/Modal';
import { useAllowedMergeMethods, useMergePr } from '../../../../queries/prs';
import { canMerge } from './mergeReadiness';
import { offeredMethods, resolveMethod } from './mergeMethods';
import { MergeConfirmStep } from './MergeConfirmStep';
import { MergeFormStep } from './MergeFormStep';

const messages = defineMessages({
  title: { id: 'content.overview.merge.title', defaultMessage: 'Merge pull request' },
  close: { id: 'content.overview.merge.close', defaultMessage: 'Close' },
});

export function MergeModal({
  pr,
  title,
  head,
  base,
  mergeReadiness,
  viewedFiles,
  totalFiles,
  onClose,
}: {
  pr: number;
  title: string;
  head: string;
  base: string;
  mergeReadiness: MergeReadiness;
  viewedFiles: number;
  totalFiles: number;
  onClose: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const merge = useMergePr();
  const allowed = useAllowedMergeMethods();
  const offered = offeredMethods(allowed.data);
  const [chosen, setChosen] = useState<MergeMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const unviewed = Math.max(0, totalFiles - viewedFiles);
  const method = resolveMethod(chosen, offered);
  const error = merge.isError ? merge.error : null;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (merge.isPending || !canMerge(mergeReadiness)) return;
    if (unviewed > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    merge.mutate({ pr, method }, { onSuccess: onClose });
  }

  return (
    <Modal
      title={<FormattedMessage {...messages.title} />}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {confirming ? (
        <MergeConfirmStep
          pr={pr}
          title={title}
          unviewed={unviewed}
          totalFiles={totalFiles}
          canConfirm={canMerge(mergeReadiness)}
          isPending={merge.isPending}
          error={error}
          onBack={() => setConfirming(false)}
        />
      ) : (
        <MergeFormStep
          pr={pr}
          title={title}
          head={head}
          base={base}
          method={method}
          offered={offered}
          mergeReadiness={mergeReadiness}
          isPending={merge.isPending}
          error={error}
          onMethodChange={setChosen}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
