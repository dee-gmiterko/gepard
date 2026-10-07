import type { Dispatch } from 'react';
import { createStore, type StoreApi } from 'zustand';
import { uiReducer, type UiAction, type UiState } from './reducer';

export interface UiStoreHandle {
  store: StoreApi<UiState>;
  dispatch: Dispatch<UiAction>;
}

export function createUiStore(initial: UiState): UiStoreHandle {
  const store = createStore<UiState>(() => initial);
  return {
    store,
    dispatch: (action) => store.setState((state) => uiReducer(state, action), true),
  };
}
