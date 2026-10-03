import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { Stack } from '../../components/Layout';
import { Message } from '../../components/Message';
import { useComments } from '../../queries/comments';
import { fileReference, prThreadsReferencingFile } from '../../helpers/comment';
import { PrCommentComposer } from './PrCommentComposer';
import { ThreadWidget } from './ThreadWidget';

const messages = defineMessages({
  notInDiff: {
    id: 'commentEditor.filePrComments.notInDiff',
    defaultMessage:
      'This file is not part of the current diff. Comments are added to the pull request with a reference to this file.',
  },
});

interface FilePrCommentsProps {
  path: string;
}

export function FilePrComments({ path }: FilePrCommentsProps): React.JSX.Element {
  const { data: threads = [] } = useComments();
  const referencing = useMemo(() => prThreadsReferencingFile(threads, path), [threads, path]);
  const references = useMemo(() => [fileReference(path)], [path]);

  return (
    <Stack>
      <Message tone="subtle">
        <FormattedMessage {...messages.notInDiff} />
      </Message>
      {referencing.map((thread) => (
        <ThreadWidget key={thread.id} thread={thread} />
      ))}
      <PrCommentComposer references={references} />
    </Stack>
  );
}
