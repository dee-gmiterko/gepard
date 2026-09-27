import { useMemo } from 'react'
import styled, { css } from 'styled-components'
import type { ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { useComments } from '../../../queries/comments'
import { Badge } from '../../../components/Badge'
import { Ellipsis } from '../../../components/Ellipsis'
import { Inline } from '../../../components/Layout'
import { PathLabel } from '../../../components/PathLabel'
import { Byline } from '../../../components/Byline'
import { Message } from '../../../components/Message'
import { sortThreadsChronologically } from './sortThreads'

const List = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`

const ThreadGroup = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const entryStyle = css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

const ThreadHeader = styled.button`
  ${entryStyle}
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
`

const Reply = styled.button`
  ${entryStyle}
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]}
    ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[6]};
`

function ThreadAnchor({ thread }: { thread: ReviewThread }): React.JSX.Element {
  return (
    <PathLabel>
      {thread.anchor.path}
      {thread.anchor.line != null ? `:${thread.anchor.line}` : ''}
    </PathLabel>
  )
}

export function CommentsTab(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr

  const { data: threads = [], isLoading } = useComments(projectId, pr ?? NaN)

  const ordered = useMemo(() => sortThreadsChronologically(threads), [threads])

  if (pr == null) return <Message>Target a PR to see its comments.</Message>
  if (isLoading) return <Message>Loading comments…</Message>
  if (ordered.length === 0) return <Message>No comments yet.</Message>

  function openThread(thread: ReviewThread): void {
    dispatch({ type: 'file/open', path: thread.anchor.path })
  }

  return (
    <List>
      {ordered.map((thread) => {
        const [root, ...replies] = thread.comments
        return (
          <ThreadGroup key={thread.id}>
            <ThreadHeader type="button" onClick={() => openThread(thread)}>
              <Inline>
                <Byline author={root.author.name ?? root.author.login} time={root.createdAt} />
                <ThreadAnchor thread={thread} />
                {root.outdated && <Badge $tone="warning">outdated</Badge>}
                {thread.isResolved && <Badge $tone="success">resolved</Badge>}
              </Inline>
              <Ellipsis>{root.body}</Ellipsis>
            </ThreadHeader>
            {replies.map((comment) => (
              <Reply key={comment.id} type="button" onClick={() => openThread(thread)}>
                <Inline>
                  <Byline
                    author={comment.author.name ?? comment.author.login}
                    time={comment.createdAt}
                  />
                  {comment.outdated && <Badge $tone="warning">outdated</Badge>}
                </Inline>
                <Ellipsis>{comment.body}</Ellipsis>
              </Reply>
            ))}
          </ThreadGroup>
        )
      })}
    </List>
  )
}
