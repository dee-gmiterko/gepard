import styled from 'styled-components';

export const Section = styled.section`
  margin-top: ${({ theme }) => theme.space[6]};

  > :first-child {
    margin-bottom: ${({ theme }) => theme.space[2]};
  }
`;
