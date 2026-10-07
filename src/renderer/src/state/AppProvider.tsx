import { useState, type ReactNode } from 'react';
import type { OpenedProject } from '@gepard/common';
import { UiStoreContext } from './AppContext';
import { appReducer, initialAppState, type AppState } from './reducer';
import { createUiStore } from './uiStore';
import { useStartup } from '../queries/projects';

function startupState(opened: OpenedProject | null | undefined): AppState {
  if (!opened) return initialAppState;
  return appReducer(initialAppState, {
    type: 'project/open',
    projectId: opened.project.id,
    targeting: opened.targeting,
    layout: opened.layout,
  });
}

function StateProvider({
  opened,
  children,
}: {
  opened: OpenedProject | null | undefined;
  children: ReactNode;
}): React.JSX.Element {
  const [handle] = useState(() => createUiStore(startupState(opened)));
  return <UiStoreContext.Provider value={handle}>{children}</UiStoreContext.Provider>;
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const startup = useStartup();
  if (startup.isPending) return null;
  return <StateProvider opened={startup.data}>{children}</StateProvider>;
}
