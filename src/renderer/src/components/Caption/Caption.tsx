import styled from 'styled-components';

export const Caption = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgSubtle};
`;
