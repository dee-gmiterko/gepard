// Comments tab (spec): chronological view of all threads and replies for the
// targeted PR, each opening the file at its anchor via `file/open`. Mounted
// with no props by Content.tsx (state/mainTab === 'comments'); reads
// projectId/pr straight from AppContext, matching that call site.
import { useMemo } from 'react'
import styled from 'styled-components'
import type { Comment, ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { useComments } from '../../../queries/comments'
import { Badge } from '../../../components/Badge'
import { Inline } from '../../../components/Layout'
import { PathLabel } from '../../../components/PathLabel'
import { Byline } from '../../../components/Byline'
import { Message } from '../../../components/Message'

const List = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`

const Entry = styled.button`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  align-items: stretch;
  text-align: left;
  width: 100%;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

const Snippet = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.fg};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface CommentEntry {
  thread: ReviewThread
  comment: Comment
}

export function CommentsTab(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr

  const { data: threads = [], isLoading } = useComments(projectId, pr ?? NaN)

  // comments.list already leaves out locally deleted threads/comments.
  const entries = useMemo<CommentEntry[]>(
    () =>
      threads
        .flatMap((thread) => thread.comments.map((comment) => ({ thread, comment })))
        .sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt)),
    [threads]
  )

  if (pr == null) return <Message>Target a PR to see its comments.</Message>
  if (isLoading) return <Message>Loading comments…</Message>
  if (entries.length === 0) return <Message>No comments yet.</Message>

  return (
    <List>
      {entries.map(({ thread, comment }) => (
        <Entry
          key={comment.id}
          type="button"
          onClick={() => dispatch({ type: 'file/open', path: thread.anchor.path })}
        >
          <Inline>
            <Byline author={comment.author.name ?? comment.author.login} time={comment.createdAt} />
            <PathLabel>
              {thread.anchor.path}
              {thread.anchor.line != null ? `:${thread.anchor.line}` : ''}
            </PathLabel>
            {comment.outdated && <Badge $tone="warning">outdated</Badge>}
          </Inline>
          <Snippet>{comment.body}</Snippet>
        </Entry>
      ))}
    </List>
  )
}
