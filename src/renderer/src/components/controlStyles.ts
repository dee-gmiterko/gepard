import { css } from 'styled-components';

export const disabledControl = css`
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

export const disabledInteractive = css<{ $disabled?: boolean }>`
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;

export const activeToggleBackground = css<{ $active?: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.bgSelected : 'transparent')};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`;

export const focusVisible = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }
`;
