import styled from 'styled-components'

export const Image = styled.img<{ $fit?: boolean }>`
  max-width: ${({ $fit }) => ($fit ? '100%' : 'none')};
  max-height: ${({ $fit }) => ($fit ? '100%' : 'none')};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border: 1px solid ${({ theme }) => theme.colors.border};
`
