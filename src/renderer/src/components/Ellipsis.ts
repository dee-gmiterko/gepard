import styled, { css } from 'styled-components';

export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ellipsis = css`
  ${truncate}
  white-space: nowrap;
`;

export const Ellipsis = styled.span`
  display: block;
  min-width: 0;
  ${ellipsis}
`;
