import styled from 'styled-components';
import { ellipsis } from '../Ellipsis';

export const PathLabel = styled.span<{ $small?: boolean }>`
  flex: 1;
  min-width: 0;
  ${ellipsis}
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme, $small }) => ($small ? theme.font.size.xs : 'inherit')};
  color: ${({ theme }) => theme.colors.fgMuted};
`;
