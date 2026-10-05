import styled, { css } from 'styled-components';
import type { Theme } from '../theme/tokens';
import type { Gap } from './Layout';

export const listReset = css`
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const List = styled.ul`
  ${listReset}
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

export const ListRow = styled.li<{
  $gap?: Gap;
  $padding?: Gap;
  $clickable?: boolean;
  $disabled?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme, $gap = 3 }) => theme.space[$gap]};
  padding: ${({ theme, $padding = 3 }) => theme.space[$padding]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};

  ${({ $clickable, theme }) =>
    $clickable &&
    css`
      &:hover {
        background: ${theme.colors.bgHover};
      }
    `}
`;

type FontSize = keyof Theme['font']['size'];

export const RowTitle = styled.div<{ $size?: FontSize }>`
  font-size: ${({ theme, $size = 'md' }) => theme.font.size[$size]};
  color: ${({ theme }) => theme.colors.fg};
`;
