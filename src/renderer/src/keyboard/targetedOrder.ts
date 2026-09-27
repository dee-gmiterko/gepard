import { useEffect } from 'react'

let order: readonly string[] = []

export function getTargetedOrder(): readonly string[] {
  return order
}

export function useRegisterTargetedOrder(paths: readonly string[]): void {
  useEffect(() => {
    order = paths
    return () => {
      if (order === paths) order = []
    }
  }, [paths])
}
