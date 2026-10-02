import { z } from 'zod';
import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { centerLayout } from './centerLayout';

export const MessageTone = z.enum(['muted', 'subtle', 'danger']);
export type MessageTone = z.infer<typeof MessageTone>;
export const MessageLayout = z.enum(['block', 'center', 'inline']);
export type MessageLayout = z.infer<typeof MessageLayout>;

const Box = styled.div<{ $tone: MessageTone; $layout: MessageLayout }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: pre-wrap;
  color: ${({ theme, $tone }) =>
    $tone === 'danger'
      ? theme.colors.danger
      : $tone === 'subtle'
        ? theme.colors.fgSubtle
        : theme.colors.fgMuted};
  ${({ theme, $layout }) =>
    $layout === 'center'
      ? centerLayout
      : $layout === 'block'
        ? css`
            padding: ${theme.space[3]};
          `
        : css``}
`;

export interface MessageProps {
  tone?: MessageTone;
  layout?: MessageLayout;
  children: ReactNode;
}

export function Message({
  tone = 'muted',
  layout = 'block',
  children,
}: MessageProps): React.JSX.Element {
  return (
    <Box $tone={tone} $layout={layout} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </Box>
  );
}
