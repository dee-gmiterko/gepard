import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

type Handler = () => void;

export type ActionHandlers = Map<string, Handler>;

export const ActionHandlersContext = createContext<ActionHandlers | null>(null);

function useActionHandlers(): ActionHandlers {
  const handlers = useContext(ActionHandlersContext);
  if (!handlers) throw new Error('Action handlers must be used within <ActionHandlersProvider>');
  return handlers;
}

export function useRunActionHandler(): (name: string) => boolean {
  const handlers = useActionHandlers();
  return useCallback(
    (name) => {
      const handler = handlers.get(name);
      if (!handler) return false;
      handler();
      return true;
    },
    [handlers],
  );
}

export function useActionHandler(name: string, handler: Handler, enabled = true): void {
  const handlers = useActionHandlers();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const current: Handler = () => ref.current();
    handlers.set(name, current);
    return () => {
      if (handlers.get(name) === current) handlers.delete(name);
    };
  }, [handlers, name, enabled]);
}
