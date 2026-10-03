import styled from 'styled-components';

export const Image = styled.img`
  max-width: 100%;
  max-height: 100%;
  background: ${({ theme }) => theme.colors.bgSubtle};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;
