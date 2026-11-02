import { Inline } from '../../../../components/Layout';
import { Muted, RowGrid, Truncated } from '../shared/overviewStyles';

const SINGLE_COLUMN = 'minmax(0, 1fr)';

export function ReviewerRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <RowGrid $columns={SINGLE_COLUMN}>
      <Inline $gap={2}>
        <Truncated>{name}</Truncated>
        <Muted>{children}</Muted>
      </Inline>
    </RowGrid>
  );
}
