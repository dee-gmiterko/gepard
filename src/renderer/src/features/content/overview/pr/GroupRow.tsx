import type { FileGroup } from '../../../../helpers/overview';
import { FileCount } from '../shared/FileCount';
import { Lines } from '../shared/Lines';
import { LinkButton, Muted, Truncated } from '../shared/overviewStyles';

export function GroupRow({
  group,
  label,
  onOpen,
}: {
  group: FileGroup;
  label: (key: string) => React.ReactNode;
  onOpen?: (key: string) => void;
}): React.JSX.Element {
  const text = <Truncated>{label(group.key)}</Truncated>;
  return (
    <>
      {onOpen ? <LinkButton onClick={() => onOpen(group.key)}>{text}</LinkButton> : text}
      <Muted>
        <FileCount files={group.files} />
      </Muted>
      <Lines additions={group.additions} deletions={group.deletions} />
    </>
  );
}
