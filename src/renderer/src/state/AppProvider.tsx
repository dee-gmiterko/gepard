import { useReducer, type ReactNode } from 'react';
import { AppDispatchContext, AppStateContext } from './AppContext';
import { appReducer, initialAppState } from './reducer';

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}
