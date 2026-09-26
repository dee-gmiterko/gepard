// Code viewer: plain read-only CodeMirror with language highlighting from
// `@codemirror/language-data` (spec Behaviors), used when no target is
// active or the active file is not one of the changed files (state/selectors
// isDiffView; routing lives in ../FileViewer.tsx). Inline comments and the
// new-thread gutter affordance are wired here for the file's RIGHT side
// (report 04 §4.3: comments only exist while a PR is targeted).
import { useEffect, useMemo, useState } from 'react'
import { lineNumbers } from '@codemirror/view'
import { useAppState } from '../../../../state/AppContext'
import { useFileContent } from '../../../../queries/files'
import { useComments } from '../../../../queries/comments'
import { useReadOnlyEditor } from '../../../../codemirror/useReadOnlyEditor'
import {
  CommentPortals,
  codeViewCommentEntries,
  commentAffordanceGutter,
  commentBlockDecorations
} from '../../../../codemirror/commentWidgets'
import { EditorHost } from '../../../../components/EditorHost'
import { Message } from '../../../../components/Message'
import { CommentPortalHost } from '../CommentPortalHost'
import { ImageViewer } from '../image/ImageViewer'
import { MissingViewer } from '../missing/MissingViewer'

export function CodeViewer({ path, sha }: { path: string; sha: string }): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  // A failed `files.content` reaches the unified toast surface via the
  // global query cache (main.tsx); with no data this viewer just stays in
  // its loading state rather than duplicating that error.
  const { data } = useFileContent(projectId, sha, path)

  if (!data) return <Message layout="center">Loading…</Message>
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />
    case 'image':
      return <ImageViewer path={path} image={data.image} />
    case 'binary':
      return <Message layout="center">Binary file not shown</Message>
    case 'text':
      return <CodeText path={path} text={data.text} />
  }
}

function CodeText({ path, text }: { path: string; text: string }): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const pr = state.targeting.pr
  const { data: threads } = useComments(projectId, pr ?? NaN)
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(
    path,
    text,
    lineNumbers()
  )
  const [draftLine, setDraftLine] = useState<number | null>(null)
  const portals = useMemo(() => new CommentPortals(), [])

  useEffect(() => {
    if (!view) return
    view.dispatch({
      effects: commentGutter.reconfigure(
        pr !== null
          ? commentAffordanceGutter(
              () => true,
              (docLine) => setDraftLine(docLine)
            )
          : []
      )
    })
  }, [pr, view, commentGutter])

  useEffect(() => {
    if (!view) return
    const entries = pr !== null ? codeViewCommentEntries(threads ?? [], path, draftLine) : []
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals))
    })
  }, [threads, draftLine, pr, path, view, comments, portals])

  return (
    <>
      <EditorHost ref={containerRef} />
      {pr !== null && (
        <CommentPortalHost
          portals={portals}
          projectId={projectId}
          pr={pr}
          onCloseDraft={() => setDraftLine(null)}
        />
      )}
    </>
  )
}
