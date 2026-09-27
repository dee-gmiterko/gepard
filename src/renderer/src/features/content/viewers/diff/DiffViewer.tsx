import { useEffect, useMemo, useState } from 'react'
import type { DiffRow } from '@shared/ipc/schemas/pr'
import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../../../i18n/defineMessages'
import { useAppState } from '../../../../state/AppContext'
import { useFileDiff } from '../../../../queries/files'
import { useComments } from '../../../../queries/comments'
import { usePrCommentScope } from '../../commentScope'
import { useReadOnlyEditor } from '../../../../codemirror/useReadOnlyEditor'
import {
  buildDiffDoc,
  diffGutters,
  diffLineDecorations,
  findDiffDocLine
} from '../../../../codemirror/diffDecorations'
import { revealDocLine } from '../../../../codemirror/revealLine'
import {
  CommentPortals,
  commentAffordanceGutter,
  commentBlockDecorations,
  diffViewCommentEntries
} from '../../../../codemirror/commentWidgets'
import { EditorHost } from '../../../../components/EditorHost'
import { Message } from '../../../../components/Message'
import { CommentPortalHost } from '../CommentPortalHost'
import { ImageDiffViewer } from '../imageDiff/ImageDiffViewer'
import { MissingViewer } from '../missing/MissingViewer'
import { viewerMessages } from '../messages'

const messages = defineMessages({
  renamedWithoutChanges: {
    id: 'content.diffViewer.renamedWithoutChanges',
    defaultMessage: 'File renamed without changes.'
  },
  noContentChanges: {
    id: 'content.diffViewer.noContentChanges',
    defaultMessage: 'No content changes.'
  }
})

export function DiffViewer({
  path,
  base,
  head
}: {
  path: string
  base: string
  head: string
}): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const { data } = useFileDiff(projectId, base, head, path)

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...viewerMessages.loading} />
      </Message>
    )
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />
    case 'binary':
      return (
        <Message layout="center">
          <FormattedMessage {...viewerMessages.binaryNotShown} />
        </Message>
      )
    case 'image':
      return <ImageDiffViewer path={path} before={data.before} after={data.after} />
    case 'text':
      if (data.rows.length === 0)
        return (
          <Message layout="center">
            <FormattedMessage
              {...(data.previousPath ? messages.renamedWithoutChanges : messages.noContentChanges)}
            />
          </Message>
        )
      return <DiffText path={path} head={head} rows={data.rows} />
  }
}

function DiffText({
  path,
  head,
  rows
}: {
  path: string
  head: string
  rows: DiffRow[]
}): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const { enabled: commentsEnabled, pr } = usePrCommentScope(path)
  const { data: threads } = useComments(projectId, pr ?? NaN)
  const singleCommitInPr = state.targeting.pr !== null && state.targeting.commit !== null

  const { doc, infos } = useMemo(() => buildDiffDoc(rows), [rows])
  const extensions = useMemo(
    () => [...diffGutters(infos), diffLineDecorations(doc, infos)],
    [doc, infos]
  )
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, doc, extensions)
  const [draft, setDraft] = useState<{ docLine: number; side: 'LEFT' | 'RIGHT' } | null>(null)
  const [wasCommentsEnabled, setWasCommentsEnabled] = useState(commentsEnabled)
  if (commentsEnabled !== wasCommentsEnabled) {
    setWasCommentsEnabled(commentsEnabled)
    if (!commentsEnabled) setDraft(null)
  }
  const portals = useMemo(() => new CommentPortals(), [])

  useEffect(() => {
    if (!view) return
    view.dispatch({
      effects: commentGutter.reconfigure(
        commentsEnabled
          ? commentAffordanceGutter(
              (docLine) => {
                const kind = infos[docLine - 1]?.kind
                if (kind === undefined || kind === 'hunk') return false
                return !(singleCommitInPr && kind === 'delete')
              },
              (docLine) => {
                const kind = infos[docLine - 1]?.kind
                setDraft({ docLine, side: kind === 'delete' ? 'LEFT' : 'RIGHT' })
              }
            )
          : []
      )
    })
  }, [commentsEnabled, infos, singleCommitInPr, view, commentGutter])

  useEffect(() => {
    if (!view) return
    const entries = commentsEnabled
      ? diffViewCommentEntries(threads ?? [], path, infos, draft, head)
      : []
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals))
    })
  }, [threads, draft, commentsEnabled, path, infos, head, view, comments, portals])

  useEffect(() => {
    if (!view || state.activeFile !== path || state.revealLine == null) return
    const docLine = findDiffDocLine(infos, state.revealLine.line, state.revealLine.side)
    if (docLine != null) revealDocLine(view, docLine)
  }, [view, path, infos, state.activeFile, state.revealLine])

  return (
    <>
      <EditorHost ref={containerRef} />
      {commentsEnabled && pr !== null && (
        <CommentPortalHost
          portals={portals}
          projectId={projectId}
          pr={pr}
          onCloseDraft={() => setDraft(null)}
        />
      )}
    </>
  )
}
