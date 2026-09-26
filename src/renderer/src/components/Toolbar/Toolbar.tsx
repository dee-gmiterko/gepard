// Thin bar above a side-panel list. The last child is pushed to the right
// edge, so a single child (e.g. a ViewModeToggle) sits right and two
// children sit at both ends.
import styled from 'styled-components'

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  & > :last-child {
    margin-left: auto;
  }
`
