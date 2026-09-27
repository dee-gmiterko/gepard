import { createContext, useContext, useEffect, type RefObject } from 'react'

export const TargetedOrderContext = createContext<RefObject<readonly string[]> | null>(null)

export function useTargetedOrderRef(): RefObject<readonly string[]> {
  const ctx = useContext(TargetedOrderContext)
  if (!ctx) throw new Error('useTargetedOrderRef must be used within <AppProvider>')
  return ctx
}

export function useRegisterTargetedOrder(paths: readonly string[]): void {
  const ref = useTargetedOrderRef()
  useEffect(() => {
    ref.current = paths
    return () => {
      if (ref.current === paths) ref.current = []
    }
  }, [paths, ref])
}
