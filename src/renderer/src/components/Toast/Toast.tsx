import styled from 'styled-components';
import { AlertTriangle, X } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { IconButton } from '../IconButton';
import { Stack } from '../Layout';
import { Surface } from '../Surface';
import { useLogPath } from '../../queries/log';
import type { ReportTone } from '../../errors/report';
import type { Toast } from '../../state/reducer';

const messages = defineMessages({
  notifications: {
    id: 'components.toast.notifications',
    defaultMessage: 'Notifications',
  },
  dismiss: {
    id: 'components.toast.dismiss',
    defaultMessage: 'Dismiss',
  },
  logPath: {
    id: 'components.toast.logPath',
    defaultMessage: 'Full log: {path}',
  },
});

export type ToastTone = ReportTone;

const Viewport = styled(Stack)`
  position: fixed;
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[3]};
  z-index: ${({ theme }) => theme.z.popover};
  width: 416px;
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
`;

const Card = styled(Surface)<{ $tone: ToastTone }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[3]};
  border-color: ${({ theme, $tone }) =>
    $tone === 'danger' ? theme.colors.danger : theme.colors.warning};
`;

const StyledIcon = styled(AlertTriangle)<{ $tone: ToastTone }>`
  flex-shrink: 0;
  margin-top: 2px;
  color: ${({ theme, $tone }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.warning)};
`;

const Text = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.fg};
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: pre-wrap;
  overflow-wrap: break-word;
`;

const Detail = styled(Text)`
  color: ${({ theme }) => theme.colors.fgMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const LogPath = styled(Detail)`
  font-family: ${({ theme }) => theme.font.mono};
  overflow-wrap: anywhere;
`;

const TextColumn = styled(Stack)`
  flex: 1;
  min-width: 0;
`;

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}): React.JSX.Element | null {
  const intl = useIntl();
  const { data: logPath } = useLogPath();
  if (toasts.length === 0) return null;
  return (
    <Viewport role="region" aria-label={intl.formatMessage(messages.notifications)}>
      {toasts.map((toast) => (
        <Card key={toast.id} $tone={toast.tone} role="alert">
          <StyledIcon size={16} $tone={toast.tone} />
          <TextColumn $gap={1}>
            <Text>{toast.message}</Text>
            {toast.detail && <Detail>{toast.detail}</Detail>}
            {toast.tone === 'danger' && logPath && (
              <LogPath>
                <FormattedMessage {...messages.logPath} values={{ path: logPath }} />
              </LogPath>
            )}
          </TextColumn>
          <IconButton
            icon={X}
            label={intl.formatMessage(messages.dismiss)}
            size={14}
            onClick={() => onDismiss(toast.id)}
          />
        </Card>
      ))}
    </Viewport>
  );
}
