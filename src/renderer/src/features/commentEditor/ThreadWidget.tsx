import { useState } from 'react';
import styled from 'styled-components';
import { Edit2, ExternalLink, Trash2, X } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { Comment, DraftAnchor, ReviewThread } from '@gepard/common';
import { useCheckoutHead } from '../../state/hooks';
import { IconButton } from '../../components/IconButton';
import { Button } from '../../components/Button';
import { Inline, Stack } from '../../components/Layout';
import { Caption } from '../../components/Caption';
import { PathAndLine } from '../../components/PathAndLine';
import { OutdatedBadge, ResolvedBadge } from '../../components/StatusBadge';
import { Byline } from '../../components/Byline';
import { Surface } from '../../components/Surface';
import { fieldChrome, textFieldBase } from '../../components/TextInput';
import { Markdown } from '../../components/Markdown';
import { useDeleteComment } from '../../queries/comments';
import { useViewer } from '../../queries/projects';
import { authorDisplayName } from '../../helpers/actor';
import { refAnchorFromDraft, refAnchorFromThread } from '../../helpers/anchor';
import { CommentEditor } from './CommentEditor';

const messages = defineMessages({
  editComment: {
    id: 'commentEditor.threadWidget.editComment',
    defaultMessage: 'Edit comment',
  },
  deleteComment: {
    id: 'commentEditor.threadWidget.deleteComment',
    defaultMessage: 'Delete comment',
  },
  confirmDeleteQuestion: {
    id: 'commentEditor.threadWidget.confirmDeleteQuestion',
    defaultMessage: 'Delete this comment?',
  },
  cancelDelete: {
    id: 'commentEditor.threadWidget.cancelDelete',
    defaultMessage: 'Cancel',
  },
  openInFile: {
    id: 'commentEditor.threadWidget.openInFile',
    defaultMessage: 'Open in file',
  },
  close: {
    id: 'commentEditor.threadWidget.close',
    defaultMessage: 'Close',
  },
  replyPlaceholder: {
    id: 'commentEditor.threadWidget.replyPlaceholder',
    defaultMessage: 'Reply…',
  },
});

interface ThreadWidgetProps {
  thread?: ReviewThread;
  draftAnchor?: DraftAnchor;
  onClose?: () => void;
  onOpen?: () => void;
}

const Wrapper = styled(Surface)`
  padding: ${({ theme }) => theme.space[2]};
  width: 100%;
  max-width: 480px;
`;

const CommentRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[2]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const ConfirmBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  text-align: center;
`;

const RowActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const ReplyPlaceholder = styled.button`
  ${textFieldBase}
  ${fieldChrome}
  text-align: left;
  width: 100%;
  padding: 6px ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.fgSubtle};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

export function ThreadWidget({
  thread,
  draftAnchor,
  onClose,
  onOpen,
}: ThreadWidgetProps): React.JSX.Element | null {
  const intl = useIntl();
  const checkoutHead = useCheckoutHead();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const del = useDeleteComment();
  const viewer = useViewer().data ?? null;

  const anchor = thread?.anchor ?? draftAnchor;
  if (!anchor) return null;
  const isGeneral = anchor.subjectType === 'PR';
  const refAnchor = thread
    ? refAnchorFromThread(thread.anchor, checkoutHead)
    : refAnchorFromDraft(anchor, checkoutHead);

  function renderComment(comment: Comment): React.JSX.Element {
    if (editingId === comment.id) {
      return (
        <CommentEditor
          key={comment.id}
          refAnchor={refAnchor}
          target={{
            kind: 'edit',
            id: comment.id,
            threadId: comment.threadId,
            initialBody: comment.body,
            initialReferences: comment.local?.references ?? [],
          }}
          onSubmitted={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      );
    }
    const isLocalDraft = comment.local?.status === 'new';
    const canEdit = comment.viewerDidAuthor;
    const canDelete = comment.viewerCanDelete || isLocalDraft;
    const confirming = confirmDeleteId === comment.id;
    if (confirming) {
      return (
        <CommentRow key={comment.id}>
          <ConfirmBox>
            <Caption>
              <FormattedMessage {...messages.confirmDeleteQuestion} />
            </Caption>
            <Inline>
              <Button
                variant="danger"
                onClick={() => {
                  del.mutate(comment.id);
                  setConfirmDeleteId(null);
                }}
                disabled={del.isPending}
              >
                <FormattedMessage {...messages.deleteComment} />
              </Button>
              <Button onClick={() => setConfirmDeleteId(null)}>
                <FormattedMessage {...messages.cancelDelete} />
              </Button>
            </Inline>
          </ConfirmBox>
        </CommentRow>
      );
    }
    return (
      <CommentRow key={comment.id}>
        <Inline>
          <Byline author={authorDisplayName(comment.author, viewer)} time={comment.createdAt} />
          {comment.outdated && <OutdatedBadge />}
          <RowActions>
            {canEdit && (
              <IconButton
                icon={Edit2}
                label={intl.formatMessage(messages.editComment)}
                size={14}
                onClick={() => setEditingId(comment.id)}
              />
            )}
            {canDelete && (
              <IconButton
                icon={Trash2}
                label={intl.formatMessage(messages.deleteComment)}
                size={14}
                onClick={() => setConfirmDeleteId(comment.id)}
              />
            )}
          </RowActions>
        </Inline>
        <Markdown>{comment.body}</Markdown>
      </CommentRow>
    );
  }

  return (
    <Wrapper>
      <Stack>
        <Inline>
          {!isGeneral && <PathAndLine path={anchor.path} line={anchor.line} />}
          {thread?.isResolved && <ResolvedBadge />}
          {thread?.isOutdated && <OutdatedBadge />}
          <RowActions>
            {!isGeneral && onOpen && (
              <IconButton
                icon={ExternalLink}
                label={intl.formatMessage(messages.openInFile)}
                size={14}
                onClick={onOpen}
              />
            )}
            {!thread && onClose && (
              <IconButton
                icon={X}
                label={intl.formatMessage(messages.close)}
                size={14}
                onClick={onClose}
              />
            )}
          </RowActions>
        </Inline>

        {thread && thread.comments.map((c) => renderComment(c))}

        {thread ? (
          replyOpen ? (
            <CommentEditor
              refAnchor={refAnchor}
              target={{ kind: 'reply', threadId: thread.id }}
              onSubmitted={() => setReplyOpen(false)}
              onCancel={() => setReplyOpen(false)}
            />
          ) : (
            <ReplyPlaceholder type="button" onClick={() => setReplyOpen(true)}>
              <FormattedMessage {...messages.replyPlaceholder} />
            </ReplyPlaceholder>
          )
        ) : (
          <CommentEditor
            refAnchor={refAnchor}
            target={{ kind: 'thread', anchor }}
            onSubmitted={() => onClose?.()}
            onCancel={() => onClose?.()}
          />
        )}
      </Stack>
    </Wrapper>
  );
}
