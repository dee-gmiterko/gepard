import type { ReactNode } from 'react';
import styled from 'styled-components';

const Term = styled.dt`
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Value = styled.dd`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: ${({ theme }) => theme.colors.fg};
`;

export function BinaryFact({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Term>{label}</Term>
      <Value>{children}</Value>
    </>
  );
}
