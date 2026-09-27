import styled from 'styled-components'
import { textFieldBase } from '../TextInput'

export const Select = styled.select`
  align-self: flex-start;
  ${textFieldBase}
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 2px ${({ theme }) => theme.space[1]};
`
