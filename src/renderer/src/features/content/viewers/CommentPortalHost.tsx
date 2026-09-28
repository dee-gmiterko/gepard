import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { CommentPortals } from '../../../components/CodeEditor/commentWidgets'
import { ThreadWidget } from '../../commentEditor/ThreadWidget'

export function CommentPortalHost({
  portals,
  onCloseDraft
}: {
  portals: CommentPortals
  onCloseDraft: () => void
}): React.JSX.Element {
  const mounted = useSyncExternalStore(portals.subscribe, portals.getSnapshot)
  return (
    <>
      {mounted.map(({ key, dom, entry }) =>
        createPortal(
          <>
            {entry.threads.map((thread) => (
              <ThreadWidget key={thread.id} thread={thread} />
            ))}
            {entry.draft && (
              <ThreadWidget key="draft" draftAnchor={entry.draft} onClose={onCloseDraft} />
            )}
          </>,
          dom,
          String(key)
        )
      )}
    </>
  )
}
