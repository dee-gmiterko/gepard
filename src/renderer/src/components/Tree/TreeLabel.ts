import styled from 'styled-components'
import { ellipsis } from '../Ellipsis'

export const TreeLabel = styled.span`
  flex: 1;
  min-width: 0;
  ${ellipsis}
  font-size: ${({ theme }) => theme.font.size.sm};
`
