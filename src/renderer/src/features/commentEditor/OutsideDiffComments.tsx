import { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Button } from '../../components/Button';
import { ActionRow, Stack } from '../../components/Layout';
import { Message } from '../../components/Message';
import { TextArea } from '../../components/TextInput';
import { useComments, useUpsertComment } from '../../queries/comments';
import { fileReference, generalThreadsReferencingFile } from '../../helpers/comment';
import { ThreadWidget } from './ThreadWidget';

const messages = defineMessages({
  notInDiff: {
    id: 'commentEditor.outsideDiff.notInDiff',
    defaultMessage:
      'This file is not part of the current diff. Comments are added to the pull request with a reference to this file.',
  },
  placeholder: {
    id: 'commentEditor.outsideDiff.placeholder',
    defaultMessage: 'Leave a comment referencing this file…',
  },
  submit: {
    id: 'commentEditor.outsideDiff.submit',
    defaultMessage: 'Submit',
  },
});

interface OutsideDiffCommentsProps {
  path: string;
}

export function OutsideDiffComments({ path }: OutsideDiffCommentsProps): React.JSX.Element {
  const intl = useIntl();
  const [body, setBody] = useState('');
  const upsert = useUpsertComment();
  const { data: threads = [] } = useComments();
  const referencing = useMemo(() => generalThreadsReferencingFile(threads, path), [threads, path]);

  function handleSubmit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    upsert.mutate(
      {
        id: null,
        threadId: null,
        anchor: null,
        general: true,
        body: trimmed,
        references: [fileReference(path)],
      },
      { onSuccess: () => setBody('') },
    );
  }

  return (
    <Stack>
      <Message tone="subtle">
        <FormattedMessage {...messages.notInDiff} />
      </Message>
      {referencing.map((thread) => (
        <ThreadWidget key={thread.id} thread={thread} />
      ))}
      <TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={intl.formatMessage(messages.placeholder)}
        rows={3}
      />
      <ActionRow>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!body.trim() || upsert.isPending}
        >
          <FormattedMessage {...messages.submit} />
        </Button>
      </ActionRow>
    </Stack>
  );
}
