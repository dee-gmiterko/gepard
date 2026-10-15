import { useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useUiDispatch } from './UiContext';
import { useToasts } from './hooks';
import { formatErrorText } from '../errors/errorMessage';
import { onReportedError } from '../errors/report';
import { ToastViewport } from '../components/Toast';

const AUTO_DISMISS_MS = 8000;

export function ToastHost(): React.JSX.Element {
  const toasts = useToasts();
  const dispatch = useUiDispatch();
  const intl = useIntl();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(
    () =>
      onReportedError((error) => {
        dispatch({
          type: 'toast/push',
          toast: {
            id: crypto.randomUUID(),
            tone: error.tone ?? 'danger',
            message: formatErrorText(intl, error.message),
            detail: error.detail,
          },
        });
      }),
    [dispatch, intl],
  );

  useEffect(() => {
    const timerMap = timers.current;
    for (const toast of toasts) {
      if (timerMap.has(toast.id) || toast.tone === 'danger') continue;
      timerMap.set(
        toast.id,
        setTimeout(() => {
          timerMap.delete(toast.id);
          dispatch({ type: 'toast/dismiss', id: toast.id });
        }, AUTO_DISMISS_MS),
      );
    }
    const liveIds = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timerMap) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timerMap.delete(id);
      }
    }
  }, [toasts, dispatch]);

  return (
    <ToastViewport toasts={toasts} onDismiss={(id) => dispatch({ type: 'toast/dismiss', id })} />
  );
}
