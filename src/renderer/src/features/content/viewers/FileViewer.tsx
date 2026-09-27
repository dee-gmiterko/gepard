import { FormattedMessage } from 'react-intl'
import { useAppState } from '../../../state/AppContext'
import { useCurrentHead } from '../../../queries/projects'
import { useChangedFiles } from '../../../queries/files'
import { useIsCheckedOutChangedFile } from '../commentScope'
import { CodeViewer } from './code/CodeViewer'
import { DiffViewer } from './diff/DiffViewer'
import { Message } from '../../../components/Message'
import { viewerMessages } from './messages'

export function FileViewer({ path }: { path: string }): React.JSX.Element {
  const state = useAppState()
  const checkout = state.checkout
  const head = useCurrentHead(state.projectId)
  const { data: changedFiles } = useChangedFiles(
    state.projectId ?? '',
    checkout?.base ?? '',
    checkout?.head ?? ''
  )
  const isChangedFile = useIsCheckedOutChangedFile(path)

  if (checkout) {
    if (!changedFiles)
      return (
        <Message layout="center">
          <FormattedMessage {...viewerMessages.loading} />
        </Message>
      )
    if (isChangedFile) return <DiffViewer path={path} base={checkout.base} head={checkout.head} />
    return <CodeViewer path={path} sha={checkout.head} />
  }

  if (!head)
    return (
      <Message layout="center">
        <FormattedMessage {...viewerMessages.loading} />
      </Message>
    )
  return <CodeViewer path={path} sha={head} />
}
