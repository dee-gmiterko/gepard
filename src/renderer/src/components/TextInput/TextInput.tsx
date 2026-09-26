// Single- and multi-line text entry (launchpad URL, search box, comment box).
import styled, { css } from 'styled-components'

const field = css`
  width: 100%;
  padding: 6px ${({ theme }) => theme.space[2]};
  font: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &::placeholder {
    color: ${({ theme }) => theme.colors.fgSubtle};
  }

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
