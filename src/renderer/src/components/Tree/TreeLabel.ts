import styled from 'styled-components';
import { PathLabel } from '../PathLabel';

export const TreeLabel = styled(PathLabel)`
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: inherit;
`;
