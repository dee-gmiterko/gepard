import { useState, type ReactNode } from 'react';
import { ActionHandlersContext, type ActionHandlers } from './actionHandlers';

export function ActionHandlersProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [handlers] = useState<ActionHandlers>(() => new Map());
  return <ActionHandlersContext value={handlers}>{children}</ActionHandlersContext>;
}
