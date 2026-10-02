import { z } from 'zod';
import styled from 'styled-components';
import type { Theme } from '../../theme/tokens';

export type Gap = keyof Theme['space'];

export const StackAlign = z.enum(['stretch', 'center', 'flex-start']);
export type StackAlign = z.infer<typeof StackAlign>;

export const Stack = styled.div<{ $gap?: Gap; $align?: StackAlign }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $align = 'stretch' }) => $align};
  gap: ${({ theme, $gap = 2 }) => theme.space[$gap]};
`;

export const Inline = styled.div<{ $gap?: Gap }>`
  display: flex;
  align-items: center;
  gap: ${({ theme, $gap = 2 }) => theme.space[$gap]};
  min-width: 0;
`;

export const ActionRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space[2]};
`;
