import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppProvider } from './state/AppProvider'
import { ToastHost } from './state/ToastHost'
import { AppThemeProvider } from './theme/ThemeProvider'
import { isCancelledError, subscribe } from './ipc/client'
import { ErrorBoundary } from './errors/ErrorBoundary'
import { reportError, reportQueryError } from './errors/report'

// Renderer-originated failures that never touch React or TanStack Query
// (event handlers, timers, promise chains no one awaits) still have to reach
// the unified surface (coordinator spec). React render errors are caught by
// errors/ErrorBoundary below instead.
window.addEventListener('error', (event) => {
  reportError({
    scope: 'window',
    message: event.error instanceof Error ? event.error.message : event.message,
    detail: event.error instanceof Error ? event.error.stack : undefined
  })
})
window.addEventListener('unhandledrejection', (event) => {
  if (isCancelledError(event.reason)) return
  const reason: unknown = event.reason
  reportError({
    scope: 'unhandledrejection',
    message: reason instanceof Error ? reason.message : String(reason),
    detail: reason instanceof Error ? reason.stack : undefined
  })
})

// Main-process failures with no renderer request behind them (process
// crashes, LSP crashes/failed restarts, session teardown failures —
// src/main/notify.ts) — main already logged these, so only toast, never log
// them again (coordinator spec: logged once, shown once).
subscribe('app.error', ({ scope, message }) => {
  reportError({ scope, message, loggedByMain: true })
})

// Background failures main pushes as domain data on their own channels
// rather than as `app.error`: a failed clone (`clone.progress` 'error',
// services/git.ts#cloneProject) and a language session that failed to start
// (`index.status` 'error', lsp/index.ts). Main already logged both, so only
// toast. Subscribed here, once for the whole app, rather than in the
// Launchpad / Header that display this data: those unmount (another project
// open, back on the launchpad) while the background job can still fail.
subscribe('clone.progress', (payload) => {
  if (payload.phase !== 'error') return
  reportError({
    scope: `clone:${payload.projectId}`,
    message: payload.message ?? 'Clone failed.',
    loggedByMain: true
  })
})
subscribe('index.status', ({ projectId, status }) => {
  if (status.state !== 'error') return
  reportError({ scope: `index:${projectId}`, message: status.message, loggedByMain: true })
})

/** A stable, human-readable-enough label for the log line's scope; never shown
 * to the user. Most mutations here are anonymous, so the numeric id is the
 * fallback. */
function mutationScope(mutation: {
  options: { mutationKey?: unknown }
  mutationId: number
}): string {
  const key = mutation.options.mutationKey
  return `mutation:${key ? JSON.stringify(key) : mutation.mutationId}`
}

// Every failed query/mutation reports itself here — once, globally — instead
// of each hook's caller rendering its own error text (coordinator spec: the
// unified toast surface makes the old per-panel error blocks redundant).
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportQueryError(`query:${query.queryHash}`, error)
  }),
  mutationCache: new MutationCache({
    // Signature is (error, variables, onMutateResult, mutation, context).
    onError: (error, _variables, _onMutateResult, mutation) =>
      reportQueryError(mutationScope(mutation), error)
  }),
  defaultOptions: {
    queries: {
      // Spec: sync is explicit (Sync button), so we never silently refetch on
      // window focus (report 04 §5.2).
      refetchOnWindowFocus: false,
      // A `CANCELLED` result means this request was superseded by a newer
      // one under main's latest-wins cancellation (search box / comment
      // editor firing per keystroke/anchor, coordinator cancellation spec):
      // retrying it would just race the request that already superseded it.
      // Anything else keeps the library's default of up to 3 retries.
      retry: (failureCount, error) => !isCancelledError(error) && failureCount < 3
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AppProvider>
          {/* Sibling of <App/>, not a descendant: stays mounted (and keeps
              showing toasts) even if <App/> crashes into ErrorBoundary's
              fallback. */}
          <ToastHost />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AppProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
