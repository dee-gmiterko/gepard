// Kept out of TextInput.tsx so that file exports only components, as
// required for React Fast Refresh.
import { css } from 'styled-components'

export const textFieldBase = css`
  font: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};

  &::placeholder {
    color: ${({ theme }) => theme.colors.fgSubtle};
  }
`
