import styled from 'styled-components';
import { ActionRow } from '../../../../components/Layout';

export const Subject = styled.div`
  font-weight: 600;
  overflow-wrap: anywhere;
`;

export const Actions = styled(ActionRow)`
  margin-top: ${({ theme }) => theme.space[4]};
`;
