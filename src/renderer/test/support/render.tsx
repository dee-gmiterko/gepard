import { StrictMode, type ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { ErrorBoundary } from '../../src/errors/ErrorBoundary';
import { IntlRoot } from '../../src/i18n/IntlRoot';
import { createQueryClient } from '../../src/queries/createQueryClient';
import { UiProvider } from '../../src/state/UiProvider';
import { ToastHost } from '../../src/state/ToastHost';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { createFakeIpc, type FakeIpc, type Handlers } from './fakeIpc';

export interface Rendered extends RenderResult {
  ipc: FakeIpc;
  user: UserEvent;
}

export function renderWithProviders(
  ui: ReactElement,
  handlers: Handlers,
  { strict = false, ipc = createFakeIpc(handlers) }: { strict?: boolean; ipc?: FakeIpc } = {},
): Rendered {
  window.ipc = ipc.bridge;
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  const tree = (
    <QueryClientProvider client={queryClient}>
      <IntlRoot>
        <AppThemeProvider>
          <UiProvider>
            <ToastHost />
            <ErrorBoundary>{ui}</ErrorBoundary>
          </UiProvider>
        </AppThemeProvider>
      </IntlRoot>
    </QueryClientProvider>
  );
  const result = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...result, ipc, user };
}

export function fileDetailsPanel(): HTMLElement {
  const panel = screen.getByText('File details').parentElement?.parentElement?.parentElement;
  if (!panel) throw new Error('file details panel is not rendered');
  return panel;
}
