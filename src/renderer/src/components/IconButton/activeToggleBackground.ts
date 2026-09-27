import { css } from 'styled-components'

export const activeToggleBackground = css<{ $active?: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.bgSelected : 'transparent')};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`
