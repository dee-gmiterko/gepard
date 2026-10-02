import styled from 'styled-components';
import { textFieldBase, fieldChrome } from '../TextInput';

export const Select = styled.select`
  align-self: flex-start;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${textFieldBase}
  ${fieldChrome}
  padding: 2px ${({ theme }) => theme.space[1]};
`;
