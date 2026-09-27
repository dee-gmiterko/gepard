import styled from 'styled-components'

export const ViewerFrame = styled.div<{ $center?: boolean }>`
  display: flex;
  height: 100%;
  overflow: auto;

  ${({ $center, theme }) =>
    $center
      ? `
    align-items: center;
    justify-content: center;
    padding: ${theme.space[4]};
  `
      : ''}
`
