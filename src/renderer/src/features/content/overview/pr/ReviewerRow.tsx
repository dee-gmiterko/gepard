import { Muted, Truncated } from '../shared/overviewStyles';

export function ReviewerRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Truncated>{name}</Truncated>
      <Muted>{children}</Muted>
    </>
  );
}
