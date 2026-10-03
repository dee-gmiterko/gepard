import { defineMessages } from 'react-intl';
import { Stack } from '../../../../components/Layout';
import { MassActionRow } from './MassActionRow';
import { useMassActions } from './useMassActions';

const messages = defineMessages({
  same: {
    id: 'content.massActions.same',
    defaultMessage:
      'Same change also in: {count, plural, one {# other file} other {# other files}}',
  },
  similar: {
    id: 'content.massActions.similar',
    defaultMessage:
      'Similar change also in: {count, plural, one {# other file} other {# other files}}',
  },
});

export function MassActions({ path }: { path: string }): React.JSX.Element | null {
  const { same, similar } = useMassActions(path);
  if (same.length === 0 && similar.length === 0) return null;
  return (
    <Stack>
      {same.length > 0 && <MassActionRow message={messages.same} paths={same} />}
      {similar.length > 0 && <MassActionRow message={messages.similar} paths={similar} />}
    </Stack>
  );
}
