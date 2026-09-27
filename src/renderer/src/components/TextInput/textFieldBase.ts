import { css } from 'styled-components'

export const textFieldBase = css`
  font: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};

  &::placeholder {
    color: ${({ theme }) => theme.colors.fgSubtle};
  }
`

export const fieldChrome = css`
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:focus-within {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`
