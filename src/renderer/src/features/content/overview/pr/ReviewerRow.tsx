import { Muted, PAIR_COLUMNS, RowGrid, Truncated } from '../shared/overviewStyles';

export function ReviewerRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <RowGrid $columns={PAIR_COLUMNS}>
      <Truncated>{name}</Truncated>
      <Muted>{children}</Muted>
    </RowGrid>
  );
}
