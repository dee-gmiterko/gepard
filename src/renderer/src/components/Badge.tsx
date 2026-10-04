import { z } from 'zod';
import styled from 'styled-components';

export const BadgeTone = z.enum(['success', 'warning', 'danger', 'muted']);
export type BadgeTone = z.infer<typeof BadgeTone>;

export const Badge = styled.span<{ $tone?: BadgeTone }>`
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
        : $tone === 'danger'
          ? theme.colors.danger
          : theme.colors.fgMuted};
`;
