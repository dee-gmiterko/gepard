import type { ButtonHTMLAttributes } from 'react';
import styled, { css } from 'styled-components';
import { disabledControl } from './disabledControl';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const StyledButton = styled.button<{ $variant: ButtonVariant; $block: boolean }>`
  display: ${({ $block }) => ($block ? 'flex' : 'inline-flex')};
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[1]};
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  font: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  ${({ theme, $variant }) =>
    $variant === 'primary'
      ? css`
          background: ${theme.colors.accent};
          color: ${theme.colors.accentFg};
        `
      : $variant === 'danger'
        ? css`
            background: transparent;
            border-color: ${theme.colors.danger};
            color: ${theme.colors.danger};

            &:hover:not(:disabled) {
              background: ${theme.colors.danger};
              color: ${theme.colors.accentFg};
            }
          `
        : css`
            background: transparent;
            border-color: ${theme.colors.border};
            color: ${theme.colors.fg};

            &:hover:not(:disabled) {
              background: ${theme.colors.bgHover};
            }
          `}

  ${disabledControl}
`;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  block = false,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  return <StyledButton type={type} $variant={variant} $block={block} {...rest} />;
}
