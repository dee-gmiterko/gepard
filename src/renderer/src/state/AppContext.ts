// Two contexts (state / dispatch) so dispatch-only components (rows,
// buttons) do not re-render on state changes (report 04 §5.1). The provider
// component lives in AppProvider.tsx (fast refresh wants component-only files).
import { createContext, useContext, type Dispatch } from 'react'
import type { AppAction, AppState } from './reducer'

export const AppStateContext = createContext<AppState | null>(null)
export const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within <AppProvider>')
  return ctx
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext)
  if (!ctx) throw new Error('useAppDispatch must be used within <AppProvider>')
  return ctx
}
