import styled from 'styled-components';
import { textFieldBase, fieldChrome } from '../TextInput';

export const Select = styled.select`
  align-self: flex-start;
  ${textFieldBase}
  ${fieldChrome}
  padding: 2px ${({ theme }) => theme.space[1]};
`;
