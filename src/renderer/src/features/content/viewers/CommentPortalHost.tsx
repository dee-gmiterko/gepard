import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { CommentPortals } from '../../../codemirror/commentWidgets'
import { ThreadWidget } from '../../commentEditor/ThreadWidget'

export function CommentPortalHost({
  portals,
  projectId,
  pr,
  onCloseDraft
}: {
  portals: CommentPortals
  projectId: string
  pr: number
  onCloseDraft: () => void
}): React.JSX.Element {
  const mounted = useSyncExternalStore(portals.subscribe, portals.getSnapshot)
  return (
    <>
      {mounted.map(({ key, dom, entry }) =>
        createPortal(
          <>
            {entry.threads.map((thread) => (
              <ThreadWidget key={thread.id} projectId={projectId} pr={pr} thread={thread} />
            ))}
            {entry.draft && (
              <ThreadWidget
                key="draft"
                projectId={projectId}
                pr={pr}
                draftAnchor={entry.draft}
                onClose={onCloseDraft}
              />
            )}
          </>,
          dom,
          String(key)
        )
      )}
    </>
  )
}
