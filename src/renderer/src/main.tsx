import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { UiProvider } from './state/UiProvider';
import { ToastHost } from './state/ToastHost';
import { AppThemeProvider } from './theme/ThemeProvider';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { installWindowErrorHandlers } from './errors/installWindowErrorHandlers';
import { subscribeBackgroundErrors } from './errors/subscribeBackgroundErrors';
import { IntlRoot } from './i18n/IntlRoot';
import { createQueryClient } from './queries/createQueryClient';

installWindowErrorHandlers();
subscribeBackgroundErrors();

const queryClient = createQueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IntlRoot>
        <AppThemeProvider>
          <UiProvider>
            <ToastHost />
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </UiProvider>
        </AppThemeProvider>
      </IntlRoot>
    </QueryClientProvider>
  </StrictMode>,
);
