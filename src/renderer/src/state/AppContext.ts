import { createContext, useContext, type Dispatch } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { UiStoreHandle } from './uiStore';
import type { AppAction, AppState } from './reducer';

export const UiStoreContext = createContext<UiStoreHandle | null>(null);

function useUiStoreHandle(): UiStoreHandle {
  const handle = useContext(UiStoreContext);
  if (!handle) throw new Error('App state hooks must be used within <AppProvider>');
  return handle;
}

export function useAppSelector<T>(selector: (state: AppState) => T): T {
  return useStore(useUiStoreHandle().store, selector);
}

export function useUiStore(): StoreApi<AppState> {
  return useUiStoreHandle().store;
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useUiStoreHandle().dispatch;
}
