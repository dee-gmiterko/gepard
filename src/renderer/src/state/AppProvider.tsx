import { useReducer, useRef, type ReactNode } from 'react'
import { AppDispatchContext, AppStateContext } from './AppContext'
import { appReducer, initialAppState } from './reducer'
import { TargetedOrderContext } from './targetedOrderStore'

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialAppState)
  const targetedOrderRef = useRef<readonly string[]>([])
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        <TargetedOrderContext.Provider value={targetedOrderRef}>
          {children}
        </TargetedOrderContext.Provider>
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  )
}
