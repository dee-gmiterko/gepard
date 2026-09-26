// Routes the active file to diff view or file view (spec Behaviors:
// "Targeting a PR or a commit enables the diff view for all changed files,
// otherwise file is shown for it"). `state.checkout` (base/head) is set once
// a PR/commit target has been checked out; the diff pair only applies to
// files that are actually part of that diff — everything else (including
// files opened from the full tree while a target is active) is a plain file
// view at the checked-out head. With no target at all, the head comes from
// the project's currently open working tree (queries/projects.ts#useOpenProject).
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
  // Shared with the file tree / targeted browser (queries/projects.ts):
  // checkout's head once a target is checked out, else the project's open head.
  const head = useCurrentHead(state.projectId)

  // A failed `files.changed` reaches the unified toast surface via the
  // global query cache (main.tsx); with no data this viewer just stays in
  // its loading state rather than duplicating that error.
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
