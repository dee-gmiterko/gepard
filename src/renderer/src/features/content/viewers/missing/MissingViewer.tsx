import { Message } from '../../../../components/Message'

export function MissingViewer({ path }: { path: string | null }): React.JSX.Element {
  return (
    <Message tone="subtle" layout="center">
      {path ? `${path} is not available here` : 'No file selected'}
    </Message>
  )
}
