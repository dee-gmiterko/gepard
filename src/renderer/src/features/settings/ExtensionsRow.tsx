import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { ExtensionInfo } from '@gepard/common';
import { Badge } from '../../components/Badge';
import { Caption } from '../../components/Caption';
import { Checkbox } from '../../components/Checkbox';
import { ListRow, RowTitle } from '../../components/List';
import { Stack, Inline } from '../../components/Layout';
import { ExtensionKindBadge } from './ExtensionKindBadge';

const messages = defineMessages({
  builtin: {
    id: 'settings.extensions.builtin',
    defaultMessage: 'Built-in',
  },
  external: {
    id: 'settings.extensions.external',
    defaultMessage: 'External',
  },
  loadFailed: {
    id: 'settings.extensions.loadFailed',
    defaultMessage: 'Failed to load: {error}',
  },
  enableExtension: {
    id: 'settings.extensions.enableExtension',
    defaultMessage: 'Enable {name}',
  },
  version: {
    id: 'settings.extensions.version',
    defaultMessage: 'v{version}',
  },
});

const RowError = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

export function ExtensionsRow({
  ext,
  disabled,
  isLastOfKind,
  onToggle,
}: {
  ext: ExtensionInfo;
  disabled: boolean;
  isLastOfKind: boolean;
  onToggle: (enabled: boolean) => void;
}): React.JSX.Element {
  const intl = useIntl();

  return (
    <ListRow $padding={2}>
      <Stack $gap={1}>
        <Inline $gap={2}>
          <RowTitle $size="sm">{ext.displayName}</RowTitle>
          <ExtensionKindBadge kind={ext.kind} />
          <Badge $tone={ext.source.kind === 'builtin' ? 'muted' : undefined}>
            <FormattedMessage
              {...(ext.source.kind === 'builtin' ? messages.builtin : messages.external)}
            />
          </Badge>
          {ext.version && (
            <Caption>
              <FormattedMessage {...messages.version} values={{ version: ext.version }} />
            </Caption>
          )}
        </Inline>
        {ext.error && (
          <RowError>
            <FormattedMessage {...messages.loadFailed} values={{ error: ext.error }} />
          </RowError>
        )}
      </Stack>
      <Checkbox
        checked={ext.enabled}
        disabled={Boolean(ext.error) || disabled || (isLastOfKind && ext.enabled)}
        ariaLabel={intl.formatMessage(messages.enableExtension, {
          name: ext.displayName,
        })}
        onChange={(checked) => onToggle(checked)}
      />
    </ListRow>
  );
}
