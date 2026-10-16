import { defineMessages, FormattedMessage } from 'react-intl';
import type { CatalogEntryStatus } from '@gepard/common';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { ListRow, RowTitle } from '../../components/List';
import { Stack, Inline } from '../../components/Layout';
import { ExtensionKindBadge } from './ExtensionKindBadge';

const messages = defineMessages({
  catalogInstall: {
    id: 'settings.extensions.catalog.install',
    defaultMessage: 'Install',
  },
  catalogUnsupported: {
    id: 'settings.extensions.catalog.unsupported',
    defaultMessage: 'Not available for this platform',
  },
  catalogInstalling: {
    id: 'settings.extensions.catalog.installing',
    defaultMessage: 'Installing…',
  },
});

export function ExtensionsCatalogRow({
  entry,
  installing,
  disabled,
  onInstall,
}: {
  entry: CatalogEntryStatus;
  installing: boolean;
  disabled: boolean;
  onInstall: () => void;
}): React.JSX.Element {
  return (
    <ListRow $padding={2}>
      <Stack $gap={1}>
        <Inline $gap={2}>
          <RowTitle $size="sm">{entry.displayName}</RowTitle>
          <ExtensionKindBadge kind={entry.kind} />
        </Inline>
        <Caption>{entry.description}</Caption>
      </Stack>
      {entry.supported ? (
        <Button variant="secondary" disabled={disabled} onClick={onInstall}>
          <FormattedMessage
            {...(installing ? messages.catalogInstalling : messages.catalogInstall)}
          />
        </Button>
      ) : (
        <Badge $tone="muted">
          <FormattedMessage {...messages.catalogUnsupported} />
        </Badge>
      )}
    </ListRow>
  );
}
