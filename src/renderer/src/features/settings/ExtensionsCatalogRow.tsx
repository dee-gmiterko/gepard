import { defineMessages, FormattedMessage } from 'react-intl';
import type { CatalogEntryStatus } from '@gepard/common';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { ListRow, RowTitle } from '../../components/List';
import { Stack, Inline } from '../../components/Layout';
import { catalogAction } from '../../helpers/extensionCatalog';
import { ExtensionKindBadge } from './ExtensionKindBadge';

const messages = defineMessages({
  builtin: {
    id: 'settings.extensions.builtin',
    defaultMessage: 'Built-in',
  },
  catalogInstalled: {
    id: 'settings.extensions.catalog.installed',
    defaultMessage: 'Installed v{version}',
  },
  catalogInstall: {
    id: 'settings.extensions.catalog.install',
    defaultMessage: 'Install',
  },
  catalogUpToDate: {
    id: 'settings.extensions.catalog.upToDate',
    defaultMessage: 'Up to date',
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

const actionMessages = {
  install: messages.catalogInstall,
  upToDate: messages.catalogUpToDate,
  builtin: messages.builtin,
  unsupported: messages.catalogUnsupported,
} as const;

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
  const action = catalogAction(entry);
  return (
    <ListRow $padding={2}>
      <Stack $gap={1}>
        <Inline $gap={2}>
          <RowTitle $size="sm">{entry.displayName}</RowTitle>
          <ExtensionKindBadge kind={entry.kind} />
          {entry.installedVersion !== null && (
            <Caption>
              <FormattedMessage
                {...messages.catalogInstalled}
                values={{ version: entry.installedVersion }}
              />
            </Caption>
          )}
        </Inline>
        <Caption>{entry.description}</Caption>
      </Stack>
      {action === 'install' ? (
        <Button variant="secondary" disabled={disabled} onClick={onInstall}>
          <FormattedMessage
            {...(installing ? messages.catalogInstalling : actionMessages[action])}
          />
        </Button>
      ) : (
        <Badge $tone="muted">
          <FormattedMessage {...actionMessages[action]} />
        </Badge>
      )}
    </ListRow>
  );
}
