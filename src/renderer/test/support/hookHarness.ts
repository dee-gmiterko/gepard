import { createElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach } from 'vitest';
import { UiStoreContext } from '../../src/state/AppContext';
import type { UiStoreHandle } from '../../src/state/uiStore';
import { createFakeIpc, type FakeIpc, type Handlers } from './fakeIpc';

export function installIpc(handlers: Handlers): FakeIpc {
  const ipc = createFakeIpc(handlers);
  Object.defineProperty(globalThis, 'window', {
    value: { ipc: ipc.bridge },
    configurable: true,
    writable: true,
  });
  return ipc;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

export function renderWith<T>(handle: UiStoreHandle, use: () => T): T {
  let captured: T | undefined;
  function Probe(): ReactNode {
    captured = use();
    return null;
  }
  renderToString(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(UiStoreContext.Provider, { value: handle }, createElement(Probe)),
    ),
  );
  if (captured === undefined) throw new Error('hook did not render');
  return captured;
}

export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
