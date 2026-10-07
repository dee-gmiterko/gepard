import { useState, type ReactNode } from 'react';
import type { OpenedProject } from '@gepard/common';
import { UiStoreContext } from './UiContext';
import { uiReducer, initialUiState, type UiState } from './reducer';
import { createUiStore } from './uiStore';
import { useStartup } from '../queries/projects';

function startupState(opened: OpenedProject | null | undefined): UiState {
  if (!opened) return initialUiState;
  return uiReducer(initialUiState, {
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

export function UiProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const startup = useStartup();
  if (startup.isPending) return null;
  return <StateProvider opened={startup.data}>{children}</StateProvider>;
}
