import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useUiDispatch } from './UiContext';
import { useToasts } from './hooks';
import { formatErrorText } from '../errors/errorMessage';
import { onReportedError } from '../errors/report';
import { ToastViewport } from '../components/Toast';

const AUTO_DISMISS_MS = 8000;

function AutoDismiss({ id }: { id: string }): null {
  const dispatch = useUiDispatch();
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'toast/dismiss', id }), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dispatch, id]);
  return null;
}

export function ToastHost(): React.JSX.Element {
  const toasts = useToasts();
  const dispatch = useUiDispatch();
  const intl = useIntl();

  useEffect(
    () =>
      onReportedError((error) => {
        dispatch({
          type: 'toast/push',
          toast: {
            id: crypto.randomUUID(),
            tone: error.tone ?? 'danger',
            message: formatErrorText(intl, error.message, error.values),
            detail: error.detail,
          },
        });
      }),
    [dispatch, intl],
  );

  return (
    <>
      {toasts
        .filter((t) => t.tone !== 'danger')
        .map((t) => (
          <AutoDismiss key={t.id} id={t.id} />
        ))}
      <ToastViewport toasts={toasts} onDismiss={(id) => dispatch({ type: 'toast/dismiss', id })} />
    </>
  );
}
