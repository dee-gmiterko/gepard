import { useEffect, useMemo } from 'react'
import { lineNumbers } from '@codemirror/view'
import { FormattedMessage } from 'react-intl'
import { useAppState } from '../../../../state/AppContext'
import { useCurrentHead } from '../../../../queries/projects'
import { useFileContent } from '../../../../queries/files'
import { useReadOnlyEditor } from '../../../../codemirror/useReadOnlyEditor'
import { revealDocLine } from '../../../../codemirror/revealLine'
import { EditorHost } from '../../../../components/EditorHost'
import { Message } from '../../../../components/Message'
import { ImageViewer } from '../image/ImageViewer'
import { MissingViewer } from '../missing/MissingViewer'
import { viewerMessages } from '../messages'

export function CodeViewer({ path }: { path: string }): React.JSX.Element {
  const sha = useCurrentHead() ?? ''
  const { data } = useFileContent(sha, path)

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...viewerMessages.loading} />
      </Message>
    )
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />
    case 'image':
      return <ImageViewer path={path} image={data.image} />
    case 'binary':
      return (
        <Message layout="center">
          <FormattedMessage {...viewerMessages.binaryNotShown} />
        </Message>
      )
    case 'text':
      return <CodeText path={path} text={data.text} />
  }
}

function CodeText({ path, text }: { path: string; text: string }): React.JSX.Element {
  const state = useAppState()
  const extensions = useMemo(() => lineNumbers(), [])
  const { containerRef, view } = useReadOnlyEditor(path, text, extensions)

  useEffect(() => {
    if (!view || state.activeFile !== path || state.revealLine == null) return
    revealDocLine(view, state.revealLine.line)
  }, [view, path, state.activeFile, state.revealLine])

  return <EditorHost ref={containerRef} />
}
