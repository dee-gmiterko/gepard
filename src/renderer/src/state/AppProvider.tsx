import { useReducer, type ReactNode } from 'react';
import type { OpenedProject } from '@gepard/common';
import { AppDispatchContext, AppStateContext } from './AppContext';
import { appReducer, initialAppState, type AppState } from './reducer';
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
  initial,
  children,
}: {
  initial: AppState;
  children: ReactNode;
}): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initial);
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const startup = useStartup();
  if (startup.isPending) return null;
  return <StateProvider initial={startupState(startup.data)}>{children}</StateProvider>;
}
