import { FormattedMessage } from 'react-intl';
import type { CatalogEntryStatus } from '@gepard/common';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { ListRow, RowTitle } from '../../components/List';
import { Stack, Inline } from '../../components/Layout';
import { catalogAction } from '../../helpers/extensionCatalog';
import { actionMessages, kindMessages, messages } from './ExtensionsMessages';

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
          <Badge $tone="muted">
            <FormattedMessage {...kindMessages[entry.kind]} />
          </Badge>
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
