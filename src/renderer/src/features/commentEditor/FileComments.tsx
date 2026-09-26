// File comments accordion content (spec: File controls floating panel "File
// comments accordion"): lists the active file's threads, each expandable
// into its full `ThreadWidget`, plus a way to start a new file-level thread
// (subjectType FILE — line-anchored threads are started from the code
// viewer's gutter, which this feature does not own).
import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { Plus } from 'react-feather'
import type { ReviewThread } from '@shared/ipc/schemas/comment'
import { Accordion } from '../../components/Accordion'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Caption } from '../../components/Caption'
import { Stack } from '../../components/Layout'
import { Message } from '../../components/Message'
import { useComments } from '../../queries/comments'
import { ThreadWidget } from './ThreadWidget'

export interface FileCommentsProps {
  projectId: string
  pr: number
  path: string
}

const LineTag = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`

const Snippet = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.fg};
`

function ThreadSummary({ thread }: { thread: ReviewThread }): React.JSX.Element {
  const root = thread.comments[0]
  const replies = thread.comments.length - 1
  return (
    <>
      <LineTag>{thread.anchor.line != null ? `L${thread.anchor.line}` : 'file'}</LineTag>
      <Snippet>{root?.body.slice(0, 80) ?? ''}</Snippet>
      {replies > 0 && (
        <Caption>
          {replies} {replies === 1 ? 'reply' : 'replies'}
        </Caption>
      )}
      {thread.isResolved && <Badge $tone="success">resolved</Badge>}
    </>
  )
}

export function FileComments({ projectId, pr, path }: FileCommentsProps): React.JSX.Element {
  const { data: threads = [] } = useComments(projectId, pr)
  const [openId, setOpenId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  const fileThreads = useMemo(
    () =>
      threads
        .filter((t) => t.anchor.path === path)
        .sort(
          (a, b) =>
            (a.anchor.line ?? Number.POSITIVE_INFINITY) -
            (b.anchor.line ?? Number.POSITIVE_INFINITY)
        ),
    [threads, path]
  )

  return (
    <Stack>
      {fileThreads.length === 0 && !addingNew && (
        <Message layout="inline">No comments on this file.</Message>
      )}

      {fileThreads.map((thread) => (
        <Accordion
          key={thread.id}
          open={openId === thread.id}
          onToggle={() => setOpenId(openId === thread.id ? null : thread.id)}
          title={<ThreadSummary thread={thread} />}
        >
          <ThreadWidget
            projectId={projectId}
            pr={pr}
            thread={thread}
            onClose={() => setOpenId(null)}
          />
        </Accordion>
      ))}

      {addingNew ? (
        <ThreadWidget
          projectId={projectId}
          pr={pr}
          draftAnchor={{
            path,
            subjectType: 'FILE',
            side: 'RIGHT',
            line: null,
            startLine: null,
            startSide: null
          }}
          onClose={() => setAddingNew(false)}
        />
      ) : (
        <div>
          <Button onClick={() => setAddingNew(true)}>
            <Plus size={14} /> New file comment
          </Button>
        </div>
      )}
    </Stack>
  )
}
