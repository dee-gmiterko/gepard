// Inline thread widget the viewers mount (coordinator spec): shows an
// existing thread with its replies and a reply editor, or a new-thread
// editor at the draft anchor. Exactly one of `thread` / `draftAnchor` is
// expected to be set by the caller.
import { useState } from 'react'
import styled from 'styled-components'
import { Edit2, Trash2, X } from 'react-feather'
import type { Comment, DraftAnchor, ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppState } from '../../state/AppContext'
import { IconButton } from '../../components/IconButton'
import { Badge } from '../../components/Badge'
import { Inline } from '../../components/Layout'
import { PathLabel } from '../../components/PathLabel'
import { Byline } from '../../components/Byline'
import { useDeleteComment } from '../../queries/comments'
import { useTargetedPaths } from '../../queries/files'
import { refAnchorFromDraft, refAnchorFromThread } from './anchorLine'
import { CommentEditor } from './CommentEditor'

export interface ThreadWidgetProps {
  projectId: string
  pr: number
  thread?: ReviewThread
  draftAnchor?: DraftAnchor
  onClose: () => void
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgElevated};
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

const CommentBody = styled.p`
  margin: 0;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.fg};
  font-size: ${({ theme }) => theme.font.size.md};
`

const RowActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
`

export function ThreadWidget({
  projectId,
  pr,
  thread,
  draftAnchor,
  onClose
}: ThreadWidgetProps): React.JSX.Element {
  const state = useAppState()
  const targetedPaths = useTargetedPaths()
  const [editingId, setEditingId] = useState<string | null>(null)
  const del = useDeleteComment(projectId, pr)

  const anchor = thread?.anchor ?? draftAnchor
  if (!anchor) return <Wrapper>Nothing to show.</Wrapper>
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
    const canEdit = comment.local?.status === 'new'
    const canDelete = comment.viewerCanDelete || canEdit
    return (
      <CommentRow key={comment.id}>
        <Inline>
          <Byline author={comment.author.name ?? comment.author.login} time={comment.createdAt} />
          {comment.outdated && <Badge $tone="warning">outdated</Badge>}
          <RowActions>
            {canEdit && (
              <IconButton
                icon={Edit2}
                label="Edit comment"
                size={14}
                onClick={() => setEditingId(comment.id)}
              />
            )}
            {canDelete && (
              <IconButton
                icon={Trash2}
                label="Delete comment"
                size={14}
                onClick={() => del.mutate(comment.id)}
                disabled={del.isPending}
              />
            )}
          </RowActions>
        </Inline>
        <CommentBody>{comment.body}</CommentBody>
      </CommentRow>
    )
  }

  return (
    <Wrapper>
      <Inline>
        <PathLabel>
          {anchor.path}
          {anchor.line != null ? `:${anchor.line}` : ''}
        </PathLabel>
        {thread?.isResolved && <Badge $tone="success">resolved</Badge>}
        {thread?.isOutdated && <Badge $tone="warning">outdated</Badge>}
        {!thread && <IconButton icon={X} label="Close" size={14} onClick={onClose} />}
      </Inline>

      {thread && thread.comments.map((c) => renderComment(c))}

      {thread ? (
        <CommentEditor
          projectId={projectId}
          pr={pr}
          refAnchor={refAnchor}
          targetedPaths={targetedPaths}
          target={{ kind: 'reply', threadId: thread.id }}
          onSubmitted={() => {}}
        />
      ) : (
        <CommentEditor
          projectId={projectId}
          pr={pr}
          refAnchor={refAnchor}
          targetedPaths={targetedPaths}
          target={{ kind: 'thread', anchor }}
          onSubmitted={onClose}
          onCancel={onClose}
        />
      )}
    </Wrapper>
  )
}
