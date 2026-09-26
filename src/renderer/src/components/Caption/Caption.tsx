// Small secondary text next to a title: timestamps, counts.
import styled from 'styled-components'

export const Caption = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgSubtle};
`
