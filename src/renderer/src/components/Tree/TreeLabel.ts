// The name in a tree row; file rows rendered by callers use it too so files
// and folders line up.
import styled from 'styled-components'

export const TreeLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${({ theme }) => theme.font.size.sm};
`
