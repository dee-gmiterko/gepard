import styled from 'styled-components';

export const Section = styled.section<{ $flush?: boolean }>`
  margin-top: ${({ theme, $flush }) => ($flush ? 0 : theme.space[6])};

  > :first-child {
    margin-bottom: ${({ theme }) => theme.space[2]};
  }
`;
