import { useMemo } from 'react'
import styled, { css } from 'styled-components'
import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
import type { ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { useComments } from '../../../queries/comments'
import { useViewer } from '../../../queries/projects'
import { authorDisplayName } from '@shared/model/actor'
import { Ellipsis } from '../../../components/Ellipsis'
import { Inline } from '../../../components/Layout'
import { Markdown } from '../../../components/Markdown'
import { PathAndLine } from '../../../components/PathAndLine'
import { Byline } from '../../../components/Byline'
import { Message } from '../../../components/Message'
import { OutdatedBadge, ResolvedBadge } from '../../../components/StatusBadge'
import { sortThreadsChronologically } from './sortThreads'

const ThreadList = styled.div`
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

const messages = defineMessages({
  targetPr: {
    id: 'content.commentsTab.targetPr',
    defaultMessage: 'Target a PR to see its comments.'
  },
  loading: {
    id: 'content.commentsTab.loading',
    defaultMessage: 'Loading comments…'
  },
  empty: {
    id: 'content.commentsTab.empty',
    defaultMessage: 'No comments yet.'
  }
})

export function CommentsTab(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const viewer = useViewer().data ?? null

  const { data: threads = [], isLoading } = useComments(projectId, pr ?? NaN)

  const ordered = useMemo(() => sortThreadsChronologically(threads), [threads])

  if (pr == null)
    return (
      <Message>
        <FormattedMessage {...messages.targetPr} />
      </Message>
    )
  if (isLoading)
    return (
      <Message>
        <FormattedMessage {...messages.loading} />
      </Message>
    )
  if (ordered.length === 0)
    return (
      <Message>
        <FormattedMessage {...messages.empty} />
      </Message>
    )

  function openThread(thread: ReviewThread): void {
    dispatch({
      type: 'file/open',
      path: thread.anchor.path,
      line: thread.anchor.line,
      side: thread.anchor.side
    })
  }

  return (
    <ThreadList>
      {ordered.map((thread) => {
        const [root, ...replies] = thread.comments
        return (
          <ThreadGroup key={thread.id}>
            <ThreadHeader type="button" onClick={() => openThread(thread)}>
              <Inline>
                <Byline author={authorDisplayName(root.author, viewer)} time={root.createdAt} />
                <PathAndLine path={thread.anchor.path} line={thread.anchor.line} />
                {root.outdated && <OutdatedBadge />}
                {thread.isResolved && <ResolvedBadge />}
              </Inline>
              <Ellipsis>
                <Markdown inline>{root.body}</Markdown>
              </Ellipsis>
            </ThreadHeader>
            {replies.map((comment) => (
              <Reply key={comment.id} type="button" onClick={() => openThread(thread)}>
                <Inline>
                  <Byline
                    author={authorDisplayName(comment.author, viewer)}
                    time={comment.createdAt}
                  />
                  {comment.outdated && <OutdatedBadge />}
                </Inline>
                <Ellipsis>
                  <Markdown inline>{comment.body}</Markdown>
                </Ellipsis>
              </Reply>
            ))}
          </ThreadGroup>
        )
      })}
    </ThreadList>
  )
}
