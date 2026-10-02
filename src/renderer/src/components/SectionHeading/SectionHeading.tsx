import { z } from 'zod';
import type { ReactNode } from 'react';
import styled from 'styled-components';

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
`;

export const SectionHeadingSize = z.enum(['md', 'lg']);
export type SectionHeadingSize = z.infer<typeof SectionHeadingSize>;

const Heading = styled.h2<{ $size: SectionHeadingSize }>`
  margin: 0;
  font-weight: 600;
  font-size: ${({ theme, $size }) => theme.font.size[$size]};
  color: ${({ theme }) => theme.colors.fg};
`;

export function SectionHeading({
  as = 'h2',
  size = 'md',
  title,
  actions,
}: {
  as?: 'h1' | 'h2';
  size?: SectionHeadingSize;
  title: ReactNode;
  actions?: ReactNode;
}): React.JSX.Element {
  const heading = (
    <Heading as={as} $size={size}>
      {title}
    </Heading>
  );
  return actions ? (
    <Row>
      {heading}
      {actions}
    </Row>
  ) : (
    heading
  );
}
