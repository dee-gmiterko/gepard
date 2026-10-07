import type { Dispatch } from 'react';
import { createStore, type StoreApi } from 'zustand';
import { appReducer, type AppAction, type AppState } from './reducer';

export interface UiStoreHandle {
  store: StoreApi<AppState>;
  dispatch: Dispatch<AppAction>;
}

export function createUiStore(initial: AppState): UiStoreHandle {
  const store = createStore<AppState>(() => initial);
  return {
    store,
    dispatch: (action) => store.setState((state) => appReducer(state, action), true),
  };
}
