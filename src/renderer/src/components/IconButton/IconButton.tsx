import type { ButtonHTMLAttributes, ComponentType } from 'react'
import styled from 'styled-components'

const StyledButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ $active, theme }) => ($active ? theme.colors.bgSelected : 'transparent')};
  color: ${({ theme }) => theme.colors.fgMuted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.fg};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ size?: number | string }>
  size?: number
  active?: boolean
  // Screen readers announce icon-only buttons by this label, since there is
  // no text content for them to read.
  label: string
}

export function IconButton({
  icon: Icon,
  size = 16,
  active,
  label,
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <StyledButton type="button" aria-label={label} title={label} $active={active} {...rest}>
      <Icon size={size} />
    </StyledButton>
  )
}
