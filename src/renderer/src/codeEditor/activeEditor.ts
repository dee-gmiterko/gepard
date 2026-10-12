import { useSyncExternalStore } from 'react';
import type { Text } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface ActiveEditor {
  view: EditorView;
  doc: Text;
}

// Only one file viewer is mounted at a time, so the latest loaded editor is the active file's.
let current: ActiveEditor | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function getActiveEditor(): ActiveEditor | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const activeEditor = {
  set(view: EditorView): void {
    current = { view, doc: view.state.doc };
    notify();
  },
  clear(view: EditorView): void {
    if (current?.view !== view) return;
    current = null;
    notify();
  },
};

export function useActiveEditor(): ActiveEditor | null {
  return useSyncExternalStore(subscribe, getActiveEditor);
}
