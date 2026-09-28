import type { ComponentType, ReactNode } from 'react';
import styled from 'styled-components';

const Field = styled.div<{ $width: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  width: ${({ $width }) => $width}px;
  color: ${({ theme }) => theme.colors.fgMuted};
`;

export function IconField({
  icon: Icon,
  width,
  children,
}: {
  icon: ComponentType<{ size?: number | string }>;
  width: number;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Field $width={width}>
      <Icon size={14} />
      {children}
    </Field>
  );
}
