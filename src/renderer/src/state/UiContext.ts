import { createContext, useContext, type Dispatch } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { UiStoreHandle } from './uiStore';
import type { UiAction, UiState } from './reducer';

export const UiStoreContext = createContext<UiStoreHandle | null>(null);

function useUiStoreHandle(): UiStoreHandle {
  const handle = useContext(UiStoreContext);
  if (!handle) throw new Error('UI state hooks must be used within <UiProvider>');
  return handle;
}

export function useUiSelector<T>(selector: (state: UiState) => T): T {
  return useStore(useUiStoreHandle().store, selector);
}

export function useUiStore(): StoreApi<UiState> {
  return useUiStoreHandle().store;
}

export function useUiDispatch(): Dispatch<UiAction> {
  return useUiStoreHandle().dispatch;
}
