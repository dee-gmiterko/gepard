import type { ReactNode } from 'react';
import styled from 'styled-components';
import { SectionHeading } from '../../../../components/SectionHeading';
import { SkeletonRows } from './SkeletonRows';

const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
`;

export function Panel({
  title,
  actions,
  isLoading = false,
  skeletonRows = 4,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Block>
      <SectionHeading title={title} actions={actions} />
      {isLoading ? <SkeletonRows rows={skeletonRows} /> : children}
    </Block>
  );
}
