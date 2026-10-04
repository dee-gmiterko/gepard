import { useEffect, useRef, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { composeIssueDescription, type ReviewThread } from '@gepard/common';
import { Button } from '../../../components/Button';
import { Message } from '../../../components/Message';
import { Modal } from '../../../components/Modal';
import { TextArea, TextInput } from '../../../components/TextInput';
import { ActionRow, Stack } from '../../../components/Layout';
import { useCreateIssue } from '../../../queries/comments';
import { localizedErrorMessage } from '../../../errors/errorMessage';

const messages = defineMessages({
  title: {
    id: 'content.composeIssueModal.title',
    defaultMessage: 'Compose issue',
  },
  close: {
    id: 'content.composeIssueModal.close',
    defaultMessage: 'Close',
  },
  titleField: {
    id: 'content.composeIssueModal.titleField',
    defaultMessage: 'Title',
  },
  descriptionField: {
    id: 'content.composeIssueModal.descriptionField',
    defaultMessage: 'Description',
  },
  hint: {
    id: 'content.composeIssueModal.hint',
    defaultMessage:
      '{count, plural, one {The local comment is} other {The # local comments are}} removed once the issue is created.',
  },
  cancel: {
    id: 'content.composeIssueModal.cancel',
    defaultMessage: 'Cancel',
  },
  creating: {
    id: 'content.composeIssueModal.creating',
    defaultMessage: 'Creating…',
  },
  create: {
    id: 'content.composeIssueModal.create',
    defaultMessage: 'Create issue',
  },
});

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Description = styled(TextArea)`
  min-height: 240px;
`;

const Actions = styled(ActionRow)`
  margin-top: ${({ theme }) => theme.space[4]};
`;

interface ComposeIssueModalProps {
  threads: readonly ReviewThread[];
  commentCount: number;
  onClose: () => void;
  onCreated: () => void;
}

export function ComposeIssueModal({
  threads,
  commentCount,
  onClose,
  onCreated,
}: ComposeIssueModalProps): React.JSX.Element {
  const intl = useIntl();
  const createIssue = useCreateIssue();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(() => composeIssueDescription(threads));
  const [threadIds] = useState(() => threads.map((t) => t.id));
  const titleRef = useRef<HTMLInputElement>(null);

  // Runs after Modal's showModal(), which would otherwise focus the close button.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const canSubmit = title.trim().length > 0 && !createIssue.isPending;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!canSubmit) return;
    createIssue.mutate(
      { title: title.trim(), body, clearUnassignedThreadIds: threadIds },
      { onSuccess: onCreated },
    );
  }

  return (
    <Modal
      title={<FormattedMessage {...messages.title} />}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="640px"
    >
      <Stack>
        <Field>
          <FormattedMessage {...messages.titleField} />
          <TextInput ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FormattedMessage {...messages.descriptionField} />
          <Description value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Message tone="subtle" layout="inline">
          <FormattedMessage {...messages.hint} values={{ count: commentCount }} />
        </Message>
        {createIssue.isError && (
          <Message tone="danger" layout="inline">
            {localizedErrorMessage(createIssue.error).message}
          </Message>
        )}
      </Stack>
      <Actions>
        <Button type="button" onClick={onClose}>
          <FormattedMessage {...messages.cancel} />
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          <FormattedMessage {...(createIssue.isPending ? messages.creating : messages.create)} />
        </Button>
      </Actions>
    </Modal>
  );
}
