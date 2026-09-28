import { css } from 'styled-components';

export const disabledInteractive = css<{ $disabled?: boolean }>`
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`;
