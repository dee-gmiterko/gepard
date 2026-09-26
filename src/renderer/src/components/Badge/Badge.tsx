// Small outlined status label (thread resolved / outdated).
import styled from 'styled-components'

export const Badge = styled.span<{ $tone?: 'success' | 'warning' | 'muted' }>`
  flex-shrink: 0;
  padding: 0 ${({ theme }) => theme.space[1]};
  border: 1px solid currentColor;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme, $tone }) =>
    $tone === 'success'
      ? theme.colors.success
      : $tone === 'warning'
        ? theme.colors.warning
        : theme.colors.fgMuted};
`
