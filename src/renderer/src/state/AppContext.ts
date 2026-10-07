import { createContext, useContext, type Dispatch } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { AppStoreHandle } from './store';
import type { AppAction, AppState } from './reducer';

export const AppStoreContext = createContext<AppStoreHandle | null>(null);

function useAppStoreHandle(): AppStoreHandle {
  const handle = useContext(AppStoreContext);
  if (!handle) throw new Error('App state hooks must be used within <AppProvider>');
  return handle;
}

export function useAppSelector<T>(selector: (state: AppState) => T): T {
  return useStore(useAppStoreHandle().store, selector);
}

export function useAppStore(): StoreApi<AppState> {
  return useAppStoreHandle().store;
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useAppStoreHandle().dispatch;
}
