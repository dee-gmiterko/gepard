import { useMemo, useState } from 'react'
import styled, { css } from 'styled-components'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
import type { ReviewThread } from '@shared/ipc/schemas/comment'
import { useAppDispatch, useAppState } from '../../../state/AppContext'
import { useComments, useUpsertComment } from '../../../queries/comments'
import { useViewer } from '../../../queries/projects'
import { authorDisplayName } from '@shared/model/actor'
import { Button } from '../../../components/Button'
import { Ellipsis } from '../../../components/Ellipsis'
import { ActionRow, Inline, Stack } from '../../../components/Layout'
import { Markdown } from '../../../components/Markdown'
import { PathAndLine } from '../../../components/PathAndLine'
import { Byline } from '../../../components/Byline'
import { Message } from '../../../components/Message'
import { OutdatedBadge, ResolvedBadge } from '../../../components/StatusBadge'
import { TextArea } from '../../../components/TextInput'
import { ThreadWidget } from '../../commentEditor/ThreadWidget'
import { sortThreadsChronologically } from './sortThreads'

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`

const ThreadList = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
`

const ComposerRow = styled.div`
  flex-shrink: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.space[3]};
`

const ThreadGroup = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const GeneralThreadGroup = styled(ThreadGroup)`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
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
  },
  addCommentPlaceholder: {
    id: 'content.commentsTab.addCommentPlaceholder',
    defaultMessage: 'Leave a comment on this pull request…'
  },
  addComment: {
    id: 'content.commentsTab.addComment',
    defaultMessage: 'Comment'
  }
})

function NewGeneralComment(): React.JSX.Element {
  const intl = useIntl()
  const [body, setBody] = useState('')
  const upsert = useUpsertComment()

  function handleSubmit(): void {
    const trimmed = body.trim()
    if (!trimmed) return
    upsert.mutate(
      { id: null, threadId: null, anchor: null, general: true, body: trimmed, references: [] },
      { onSuccess: () => setBody('') }
    )
  }

  return (
    <Stack>
      <TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={intl.formatMessage(messages.addCommentPlaceholder)}
        rows={3}
      />
      <ActionRow>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!body.trim() || upsert.isPending}
        >
          <FormattedMessage {...messages.addComment} />
        </Button>
      </ActionRow>
    </Stack>
  )
}

export function CommentsTab(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const pr = state.targeting.pr
  const viewer = useViewer().data ?? null

  const { data: threads = [], isLoading } = useComments()

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

  function openThread(thread: ReviewThread): void {
    if (thread.anchor.subjectType === 'PR') return
    dispatch({
      type: 'file/open',
      path: thread.anchor.path,
      line: thread.anchor.line,
      side: thread.anchor.side
    })
  }

  return (
    <Panel>
      <ThreadList>
        {ordered.length === 0 ? (
          <Message>
            <FormattedMessage {...messages.empty} />
          </Message>
        ) : (
          ordered.map((thread) => {
            const isGeneral = thread.anchor.subjectType === 'PR'
            if (isGeneral) {
              return (
                <GeneralThreadGroup key={thread.id}>
                  <ThreadWidget thread={thread} />
                </GeneralThreadGroup>
              )
            }
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
          })
        )}
      </ThreadList>
      <ComposerRow>
        <NewGeneralComment />
      </ComposerRow>
    </Panel>
  )
}
