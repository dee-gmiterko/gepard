import styled, { css } from 'styled-components'
import { textFieldBase, fieldChrome } from './textFieldBase'

const field = css`
  ${textFieldBase}
  ${fieldChrome}
  width: 100%;
  padding: 6px ${({ theme }) => theme.space[2]};
`

export const TextInput = styled.input`
  ${field}
`

export const TextArea = styled.textarea`
  ${field}
  min-height: 60px;
  resize: vertical;
`
