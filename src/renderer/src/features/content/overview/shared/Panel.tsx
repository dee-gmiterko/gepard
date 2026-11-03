import { useId, type ReactNode } from 'react';
import styled from 'styled-components';
import { SectionHeading } from '../../../../components/SectionHeading';

const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
`;

export function Panel({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  const id = useId();
  return (
    <Block aria-labelledby={id}>
      <SectionHeading title={<span id={id}>{title}</span>} actions={actions} />
      {children}
    </Block>
  );
}
