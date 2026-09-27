import { useEffect, useMemo, useState } from 'react'
import type { DiffRow } from '@shared/ipc/schemas/pr'
import { useAppState } from '../../../../state/AppContext'
import { useFileDiff } from '../../../../queries/files'
import { useComments } from '../../../../queries/comments'
import { useReadOnlyEditor } from '../../../../codemirror/useReadOnlyEditor'
import {
  buildDiffDoc,
  diffGutters,
  diffLineDecorations
} from '../../../../codemirror/diffDecorations'
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

  if (!data) return <Message layout="center">Loading…</Message>
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />
    case 'binary':
      return <Message layout="center">Binary file not shown</Message>
    case 'image':
      return <ImageDiffViewer path={path} before={data.before} after={data.after} />
    case 'text':
      if (data.rows.length === 0)
        return (
          <Message layout="center">
            {data.previousPath ? 'File renamed without changes.' : 'No content changes.'}
          </Message>
        )
      return <DiffText path={path} rows={data.rows} />
  }
}

function DiffText({ path, rows }: { path: string; rows: DiffRow[] }): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const { data: threads } = useComments(projectId, pr ?? NaN)

  const { doc, infos } = useMemo(() => buildDiffDoc(rows), [rows])
  const extensions = useMemo(
    () => [...diffGutters(infos), diffLineDecorations(doc, infos)],
    [doc, infos]
  )
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, doc, extensions)
  const [draft, setDraft] = useState<{ docLine: number; side: 'LEFT' | 'RIGHT' } | null>(null)
  const portals = useMemo(() => new CommentPortals(), [])

  useEffect(() => {
    if (!view) return
    view.dispatch({
      effects: commentGutter.reconfigure(
        pr !== null
          ? commentAffordanceGutter(
              (docLine) => infos[docLine - 1]?.kind !== 'hunk',
              (docLine) => {
                const kind = infos[docLine - 1]?.kind
                setDraft({ docLine, side: kind === 'delete' ? 'LEFT' : 'RIGHT' })
              }
            )
          : []
      )
    })
  }, [pr, infos, view, commentGutter])

  useEffect(() => {
    if (!view) return
    const entries = pr !== null ? diffViewCommentEntries(threads ?? [], path, infos, draft) : []
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals))
    })
  }, [threads, draft, pr, path, infos, view, comments, portals])

  return (
    <>
      <EditorHost ref={containerRef} />
      {pr !== null && (
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
