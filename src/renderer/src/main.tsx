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
import { IntlRoot } from './i18n/IntlRoot'
import { intl } from './i18n/intl'
import { defineMessages } from './i18n/defineMessages'

const messages = defineMessages({
  cloneFailed: {
    id: 'main.cloneFailed',
    defaultMessage: 'Clone failed.'
  }
})

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

subscribe('app.error', ({ scope, message }) => {
  reportError({ scope, message, loggedByMain: true })
})

subscribe('clone.progress', (payload) => {
  if (payload.phase !== 'error') return
  reportError({
    scope: `clone:${payload.projectId}`,
    message: intl.formatMessage(messages.cloneFailed),
    detail: payload.message,
    loggedByMain: true
  })
})
subscribe('index.status', ({ projectId, status }) => {
  if (status.state !== 'error') return
  reportError({ scope: `index:${projectId}`, message: status.message, loggedByMain: true })
})

function mutationScope(mutation: {
  options: { mutationKey?: unknown }
  mutationId: number
}): string {
  const key = mutation.options.mutationKey
  return `mutation:${key ? JSON.stringify(key) : mutation.mutationId}`
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportQueryError(`query:${query.queryHash}`, error)
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) =>
      reportQueryError(mutationScope(mutation), error)
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !isCancelledError(error) && failureCount < 3
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntlRoot>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <AppProvider>
            <ToastHost />
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AppProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </IntlRoot>
  </StrictMode>
)
