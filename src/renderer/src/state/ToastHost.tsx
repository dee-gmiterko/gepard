import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppState } from './AppContext';
import { onReportedError } from '../errors/report';
import { ToastViewport } from '../components/Toast';

const AUTO_DISMISS_MS = 8000;

export function ToastHost(): React.JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(
    () =>
      onReportedError((error) => {
        dispatch({
          type: 'toast/push',
          toast: {
            id: crypto.randomUUID(),
            tone: error.tone ?? 'danger',
            message: error.message,
            detail: error.detail,
          },
        });
      }),
    [dispatch],
  );

  useEffect(() => {
    const timerMap = timers.current;
    for (const toast of state.toasts) {
      if (timerMap.has(toast.id) || toast.tone === 'danger') continue;
      timerMap.set(
        toast.id,
        setTimeout(() => {
          timerMap.delete(toast.id);
          dispatch({ type: 'toast/dismiss', id: toast.id });
        }, AUTO_DISMISS_MS),
      );
    }
    const liveIds = new Set(state.toasts.map((t) => t.id));
    for (const [id, timer] of timerMap) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timerMap.delete(id);
      }
    }
  }, [state.toasts, dispatch]);

  return (
    <ToastViewport
      toasts={state.toasts}
      onDismiss={(id) => dispatch({ type: 'toast/dismiss', id })}
    />
  );
}
