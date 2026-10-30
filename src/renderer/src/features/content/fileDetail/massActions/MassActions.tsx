import { defineMessages } from 'react-intl';
import { Stack } from '../../../../components/Layout';
import { MassActionRow } from './MassActionRow';

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
  deleted: {
    id: 'content.massActions.deleted',
    defaultMessage:
      'Mark all deleted files as viewed: {count, plural, one {# other file} other {# other files}}',
  },
});

export function MassActions({
  sameSet,
  similarSet,
  deletedSet,
}: {
  sameSet?: string[];
  similarSet?: string[];
  deletedSet?: string[];
}): React.JSX.Element | null {
  if (!sameSet && !similarSet && !deletedSet) return null;
  return (
    <Stack>
      {sameSet && <MassActionRow message={messages.same} paths={sameSet} />}
      {similarSet && <MassActionRow message={messages.similar} paths={similarSet} />}
      {deletedSet && <MassActionRow message={messages.deleted} paths={deletedSet} />}
    </Stack>
  );
}
