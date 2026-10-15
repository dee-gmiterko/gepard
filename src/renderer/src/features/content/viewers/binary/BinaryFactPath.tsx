import type { ReactNode } from 'react';
import styled from 'styled-components';
import { BinaryFact } from './BinaryFact';

const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
`;

export function BinaryFactPath({
  label,
  path,
}: {
  label: ReactNode;
  path: string;
}): React.JSX.Element {
  return (
    <BinaryFact label={label}>
      <Mono title={path}>{path}</Mono>
    </BinaryFact>
  );
}
