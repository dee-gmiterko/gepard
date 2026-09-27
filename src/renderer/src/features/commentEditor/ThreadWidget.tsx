import { useState } from 'react'
import styled from 'styled-components'
import { Edit2, Trash2, X } from 'react-feather'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import type { Comment, DraftAnchor, ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppState } from '../../state/AppContext'
import { IconButton } from '../../components/IconButton'
import { Button } from '../../components/Button'
import { Inline } from '../../components/Layout'
import { Caption } from '../../components/Caption'
import { PathAndLine } from '../../components/PathAndLine'
import { OutdatedBadge, ResolvedBadge } from '../../components/StatusBadge'
import { Byline } from '../../components/Byline'
import { Surface } from '../../components/Surface'
import { fieldChrome, textFieldBase } from '../../components/TextInput'
import { Markdown } from '../../components/Markdown'
import { useDeleteComment } from '../../queries/comments'
import { useTargetedPaths } from '../../queries/files'
import { useViewer } from '../../queries/projects'
import { authorDisplayName } from '@shared/model/actor'
import { refAnchorFromDraft, refAnchorFromThread } from './anchorLine'
import { CommentEditor } from './CommentEditor'

const messages = defineMessages({
  editComment: {
    id: 'commentEditor.threadWidget.editComment',
    defaultMessage: 'Edit comment'
  },
  deleteComment: {
    id: 'commentEditor.threadWidget.deleteComment',
    defaultMessage: 'Delete comment'
  },
  confirmDeleteQuestion: {
    id: 'commentEditor.threadWidget.confirmDeleteQuestion',
    defaultMessage: 'Delete this comment?'
  },
  cancelDelete: {
    id: 'commentEditor.threadWidget.cancelDelete',
    defaultMessage: 'Cancel'
  },
  close: {
    id: 'commentEditor.threadWidget.close',
    defaultMessage: 'Close'
  },
  replyPlaceholder: {
    id: 'commentEditor.threadWidget.replyPlaceholder',
    defaultMessage: 'Reply…'
  }
})

export interface ThreadWidgetProps {
  projectId: string
  pr: number
  thread?: ReviewThread
  draftAnchor?: DraftAnchor
  onClose?: () => void
}

const Wrapper = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  width: 100%;
  max-width: 480px;
`

const CommentRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[2]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`

const RowActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`

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
`

export function ThreadWidget({
  projectId,
  pr,
  thread,
  draftAnchor,
  onClose
}: ThreadWidgetProps): React.JSX.Element | null {
  const intl = useIntl()
  const state = useAppState()
  const targetedPaths = useTargetedPaths()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const del = useDeleteComment(projectId, pr)
  const viewer = useViewer().data ?? null

  const anchor = thread?.anchor ?? draftAnchor
  if (!anchor) return null
  const refAnchor = thread
    ? refAnchorFromThread(thread.anchor, state.checkout)
    : refAnchorFromDraft(anchor, state.checkout)

  function renderComment(comment: Comment): React.JSX.Element {
    if (editingId === comment.id) {
      return (
        <CommentEditor
          key={comment.id}
          projectId={projectId}
          pr={pr}
          refAnchor={refAnchor}
          targetedPaths={targetedPaths}
          target={{
            kind: 'edit',
            id: comment.id,
            threadId: comment.threadId,
            initialBody: comment.body,
            initialReferences: comment.local?.references ?? []
          }}
          onSubmitted={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      )
    }
    const isLocalDraft = comment.local?.status === 'new'
    const canEdit = comment.viewerDidAuthor && comment.local?.status !== 'deleted'
    const canDelete = comment.viewerCanDelete || isLocalDraft
    const confirming = confirmDeleteId === comment.id
    return (
      <CommentRow key={comment.id}>
        <Inline>
          <Byline author={authorDisplayName(comment.author, viewer)} time={comment.createdAt} />
          {comment.outdated && <OutdatedBadge />}
          <RowActions>
            {confirming ? (
              <>
                <Caption>
                  <FormattedMessage {...messages.confirmDeleteQuestion} />
                </Caption>
                <Button
                  variant="danger"
                  onClick={() => {
                    del.mutate(comment.id)
                    setConfirmDeleteId(null)
                  }}
                  disabled={del.isPending}
                >
                  <FormattedMessage {...messages.deleteComment} />
                </Button>
                <Button onClick={() => setConfirmDeleteId(null)}>
                  <FormattedMessage {...messages.cancelDelete} />
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </RowActions>
        </Inline>
        <Markdown>{comment.body}</Markdown>
      </CommentRow>
    )
  }

  return (
    <Wrapper>
      <Inline>
        <PathAndLine path={anchor.path} line={anchor.line} />
        {thread?.isResolved && <ResolvedBadge />}
        {thread?.isOutdated && <OutdatedBadge />}
        {!thread && onClose && (
          <IconButton
            icon={X}
            label={intl.formatMessage(messages.close)}
            size={14}
            onClick={onClose}
          />
        )}
      </Inline>

      {thread && thread.comments.map((c) => renderComment(c))}

      {thread ? (
        replyOpen ? (
          <CommentEditor
            projectId={projectId}
            pr={pr}
            refAnchor={refAnchor}
            targetedPaths={targetedPaths}
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
          projectId={projectId}
          pr={pr}
          refAnchor={refAnchor}
          targetedPaths={targetedPaths}
          target={{ kind: 'thread', anchor }}
          onSubmitted={() => onClose?.()}
          onCancel={() => onClose?.()}
        />
      )}
    </Wrapper>
  )
}
