// An image on a subtle background with a hairline border, so transparent
// images and their bounds stay visible (image and image diff viewers).
import styled from 'styled-components'

export const Image = styled.img<{ $fit?: boolean }>`
  max-width: ${({ $fit }) => ($fit ? '100%' : 'none')};
  max-height: ${({ $fit }) => ($fit ? '100%' : 'none')};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border: 1px solid ${({ theme }) => theme.colors.border};
`
