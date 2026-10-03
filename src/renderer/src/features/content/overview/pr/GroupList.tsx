import type { FileGroup } from '../../../../helpers/overview';
import { Grid } from '../shared/overviewStyles';
import { GroupRow } from './GroupRow';

const MAX_ROWS = 8;

export function GroupList({
  groups,
  label,
  onOpen,
}: {
  groups: readonly FileGroup[];
  label: (key: string) => React.ReactNode;
  onOpen?: (key: string) => void;
}): React.JSX.Element {
  return (
    <Grid $columns="minmax(0, 1fr) auto auto">
      {groups.slice(0, MAX_ROWS).map((g) => (
        <GroupRow key={g.key} group={g} label={label} onOpen={onOpen} />
      ))}
    </Grid>
  );
}
