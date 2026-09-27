import styled, { css } from 'styled-components'
import { textFieldBase } from './textFieldBase'

const field = css`
  ${textFieldBase}
  width: 100%;
  padding: 6px ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`

export const TextInput = styled.input`
  ${field}
`

export const TextArea = styled.textarea`
  ${field}
  min-height: 60px;
  resize: vertical;
`
