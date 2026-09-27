import { useEffect, useMemo, useState } from 'react'
import type { DiffRow } from '@shared/ipc/schemas/pr'
import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../../../i18n/defineMessages'
import { useAppState } from '../../../../state/AppContext'
import { useFileDiff } from '../../../../queries/files'
import { useComments } from '../../../../queries/comments'
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

export function DiffViewer({ path }: { path: string }): React.JSX.Element {
  const { data } = useFileDiff(path)

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
      return <DiffText path={path} rows={data.rows} />
  }
}

function DiffText({ path, rows }: { path: string; rows: DiffRow[] }): React.JSX.Element {
  const state = useAppState()
  const pr = state.targeting.pr
  const commentsEnabled = pr !== null
  const { data: threads } = useComments()
  const head = state.checkout?.head ?? ''
  const singleCommitInPr = pr !== null && state.targeting.commit !== null

  const { doc, infos } = useMemo(() => buildDiffDoc(rows), [rows])
  const extensions = useMemo(
    () => [...diffGutters(infos), diffLineDecorations(doc, infos)],
    [doc, infos]
  )
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, doc, extensions)
  const [draft, setDraft] = useState<{ docLine: number; side: 'LEFT' | 'RIGHT' } | null>(null)
  const activeDraft = commentsEnabled ? draft : null
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
      ? diffViewCommentEntries(threads ?? [], path, infos, activeDraft, head)
      : []
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals))
    })
  }, [threads, activeDraft, commentsEnabled, path, infos, head, view, comments, portals])

  useEffect(() => {
    if (!view || state.activeFile !== path || state.revealLine == null) return
    const docLine = findDiffDocLine(infos, state.revealLine.line, state.revealLine.side)
    if (docLine != null) revealDocLine(view, docLine)
  }, [view, path, infos, state.activeFile, state.revealLine])

  return (
    <>
      <EditorHost ref={containerRef} />
      {commentsEnabled && (
        <CommentPortalHost portals={portals} onCloseDraft={() => setDraft(null)} />
      )}
    </>
  )
}
