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
  const checkout = useAppState().checkout
  const head = useCurrentHead()
  const { data: changedFiles } = useChangedFiles()
  const isChangedFile = useIsCheckedOutChangedFile(path)

  if (checkout) {
    if (!changedFiles)
      return (
        <Message layout="center">
          <FormattedMessage {...viewerMessages.loading} />
        </Message>
      )
    if (isChangedFile) return <DiffViewer path={path} />
    return <CodeViewer path={path} />
  }

  if (!head)
    return (
      <Message layout="center">
        <FormattedMessage {...viewerMessages.loading} />
      </Message>
    )
  return <CodeViewer path={path} />
}
