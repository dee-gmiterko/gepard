import type { ComponentType, ReactNode } from 'react';
import styled from 'styled-components';

const Field = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  width: 260px;
  color: ${({ theme }) => theme.colors.fgMuted};
`;

export function IconField({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ size?: number | string }>;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Field>
      <Icon size={14} />
      {children}
    </Field>
  );
}
