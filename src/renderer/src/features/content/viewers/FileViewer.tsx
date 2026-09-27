import { useMemo } from 'react'
import { useAppState } from '../../../state/AppContext'
import { useCurrentHead } from '../../../queries/projects'
import { useChangedFiles } from '../../../queries/files'
import { CodeViewer } from './code/CodeViewer'
import { DiffViewer } from './diff/DiffViewer'
import { Message } from '../../../components/Message'

export function FileViewer({ path }: { path: string }): React.JSX.Element {
  const state = useAppState()
  const projectId = state.projectId ?? ''
  const checkout = state.checkout
  const head = useCurrentHead(state.projectId)

  const { data: changedFiles } = useChangedFiles(
    projectId,
    checkout?.base ?? '',
    checkout?.head ?? ''
  )

  const isChangedFile = useMemo(() => {
    if (!checkout || !changedFiles) return false
    return changedFiles.some((f) => f.path === path || f.previousPath === path)
  }, [checkout, changedFiles, path])

  if (checkout) {
    if (!changedFiles) return <Message layout="center">Loading…</Message>
    if (isChangedFile) return <DiffViewer path={path} base={checkout.base} head={checkout.head} />
    return <CodeViewer path={path} sha={checkout.head} />
  }

  if (!head) return <Message layout="center">Loading…</Message>
  return <CodeViewer path={path} sha={head} />
}
