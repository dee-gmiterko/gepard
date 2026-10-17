import styled from 'styled-components';

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

  /* Fingers need a wider hit area than the 6px visual handle. */
  @media (pointer: coarse) {
    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -12px;
      right: -12px;
    }
  }
`;
