import styled from 'styled-components';
import { Stack } from '../../../../components/Layout';
import { Skeleton } from '../../../../components/Skeleton';
import { Table } from './overviewStyles';

const WIDTHS = ['90%', '70%', '80%', '60%', '75%'];

const Rows = styled(Stack)`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
`;

export function SkeletonRows({ rows = 3 }: { rows?: number }): React.JSX.Element {
  return (
    <Table aria-busy="true">
      <Rows $gap={2}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} width={WIDTHS[i % WIDTHS.length]} />
        ))}
      </Rows>
    </Table>
  );
}
