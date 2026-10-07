import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { CommentReference } from '@gepard/common';
import { Button } from '../../components/Button';
import { ActionRow, Stack } from '../../components/Layout';
import { TextArea } from '../../components/TextInput';
import { useUpsertComment } from '../../queries/comments';
import { useTargetPr } from '../../state/hooks';

const messages = defineMessages({
  placeholder: {
    id: 'commentEditor.prCommentComposer.placeholder',
    defaultMessage: 'Leave a comment on this pull request…',
  },
  unassignedPlaceholder: {
    id: 'commentEditor.prCommentComposer.unassignedPlaceholder',
    defaultMessage: 'Leave a general comment…',
  },
  submit: {
    id: 'commentEditor.prCommentComposer.submit',
    defaultMessage: 'Comment',
  },
});

interface PrCommentComposerProps {
  references?: CommentReference[];
}

export function PrCommentComposer({ references = [] }: PrCommentComposerProps): React.JSX.Element {
  const intl = useIntl();
  const [body, setBody] = useState('');
  const upsert = useUpsertComment();
  const unassigned = useTargetPr() === null;

  function handleSubmit(): void {
    const trimmed = body.trim();
    if (!trimmed) return;
    upsert.mutate(
      { id: null, threadId: null, anchor: null, general: true, body: trimmed, references },
      { onSuccess: () => setBody('') },
    );
  }

  return (
    <Stack>
      <TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={intl.formatMessage(
          unassigned ? messages.unassignedPlaceholder : messages.placeholder,
        )}
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
