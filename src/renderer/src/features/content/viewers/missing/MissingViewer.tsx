// Missing view: shown for pinned files that don't exist in the current
// state (spec Behaviors), or when nothing is active yet. Plain message
// (report 04 §6).
import { Message } from '../../../../components/Message'

export function MissingViewer({ path }: { path: string | null }): React.JSX.Element {
  return (
    <Message tone="subtle" layout="center">
      {path ? `${path} is not available here` : 'No file selected'}
    </Message>
  )
}
