// The unified toast surface, over the shared AppContext (coordinator spec).
// Mounted once at the app root (main.tsx), as a sibling of <App/> rather than
// a descendant, so it keeps showing toasts even if <App/> itself crashes and
// is replaced by errors/ErrorBoundary's fallback. Subscribes to
// errors/report.ts's reportError() — the one function every failure path in
// the renderer calls — and is the only thing that turns a report into an
// AppContext dispatch; everything else (Toast.tsx) is presentational.
import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppState } from './AppContext'
import { onReportedError } from '../errors/report'
import { ToastViewport } from '../components/Toast'

const AUTO_DISMISS_MS = 8000

export function ToastHost(): React.JSX.Element {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(
    () =>
      onReportedError((error) => {
        dispatch({
          type: 'toast/push',
          toast: { id: crypto.randomUUID(), tone: error.tone ?? 'danger', message: error.message }
        })
      }),
    [dispatch]
  )

  // Auto-dismiss: one timer per live toast id, cleared as toasts are
  // dismissed (by timeout or by the user) so nothing double-fires.
  useEffect(() => {
    const timerMap = timers.current
    for (const toast of state.toasts) {
      if (timerMap.has(toast.id)) continue
      timerMap.set(
        toast.id,
        setTimeout(() => {
          timerMap.delete(toast.id)
          dispatch({ type: 'toast/dismiss', id: toast.id })
        }, AUTO_DISMISS_MS)
      )
    }
    const liveIds = new Set(state.toasts.map((t) => t.id))
    for (const [id, timer] of timerMap) {
      if (!liveIds.has(id)) {
        clearTimeout(timer)
        timerMap.delete(id)
      }
    }
  }, [state.toasts, dispatch])

  return (
    <ToastViewport
      toasts={state.toasts}
      onDismiss={(id) => dispatch({ type: 'toast/dismiss', id })}
    />
  )
}
