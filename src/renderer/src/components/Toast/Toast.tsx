// The one visible surface for every failure in the app (coordinator spec:
// "one unified toast surface over the shared app context"), instead of the
// Message(tone="danger") blocks that used to be repeated per panel. Purely
// presentational — state/ToastHost.tsx owns the toast list (AppContext) and
// wires reportError() (errors/report.ts) into it.
import styled from 'styled-components'
import { AlertTriangle, X } from 'react-feather'
import { IconButton } from '../IconButton'

export type ToastTone = 'danger' | 'warning'

export interface ToastItem {
  id: string
  tone: ToastTone
  message: string
}

const Viewport = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[3]};
  z-index: ${({ theme }) => theme.z.popover};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  width: 320px;
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
`

const Card = styled.div<{ $tone: ToastTone }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid
    ${({ theme, $tone }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.warning)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadow.popover};
`

const StyledIcon = styled(AlertTriangle)<{ $tone: ToastTone }>`
  flex-shrink: 0;
  margin-top: 2px;
  color: ${({ theme, $tone }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.warning)};
`

const Text = styled.p`
  flex: 1;
  min-width: 0;
  margin: 0;
  color: ${({ theme }) => theme.colors.fg};
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: pre-wrap;
  overflow-wrap: break-word;
`

export function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}): React.JSX.Element | null {
  if (toasts.length === 0) return null
  return (
    <Viewport role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <Card key={toast.id} $tone={toast.tone} role="alert">
          <StyledIcon size={16} $tone={toast.tone} />
          <Text>{toast.message}</Text>
          <IconButton icon={X} label="Dismiss" size={14} onClick={() => onDismiss(toast.id)} />
        </Card>
      ))}
    </Viewport>
  )
}
