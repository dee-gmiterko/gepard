import { css } from 'styled-components';

export const centerLayout = css`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.space[4]};
  text-align: center;
`;
