import type { ButtonHTMLAttributes, ComponentType } from 'react'
import styled from 'styled-components'
import { disabledControl } from '../Button'
import { activeToggleBackground } from './activeToggleBackground'
import { focusVisible } from './focusVisible'

const StyledButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.fgMuted};
  cursor: pointer;
  ${activeToggleBackground}

  &:hover {
    color: ${({ theme }) => theme.colors.fg};
  }

  ${disabledControl}
  ${focusVisible}
`

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ size?: number | string }>
  size?: number
  active?: boolean
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
    <StyledButton
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      $active={active}
      {...rest}
    >
      <Icon size={size} />
    </StyledButton>
  )
}
