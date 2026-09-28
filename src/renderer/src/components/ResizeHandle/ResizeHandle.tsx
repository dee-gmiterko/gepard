import styled from 'styled-components'

export const ResizeHandle = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
  z-index: 1;

  &:hover,
  &:active {
    background: ${({ theme }) => theme.colors.accent};
    opacity: 0.5;
  }
`
