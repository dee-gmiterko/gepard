import styled from 'styled-components'
import { Plus } from 'react-feather'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Checkbox } from '../../components/Checkbox'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Caption } from '../../components/Caption'
import { Message } from '../../components/Message'
import { List, ListRow, RowTitle } from '../../components/List'
import { Stack, Inline } from '../../components/Layout'
import { Section } from '../../components/Section'
import { SectionHeading } from '../../components/SectionHeading'
import {
  useExtensions,
  useExtensionsDir,
  useInstallExtension,
  useSetExtensionEnabled
} from '../../queries/extensions'

const messages = defineMessages({
  title: {
    id: 'settings.extensions.title',
    defaultMessage: 'Extensions'
  },
  addExtension: {
    id: 'settings.extensions.addExtension',
    defaultMessage: 'Add extension'
  },
  installedIn: {
    id: 'settings.extensions.installedIn',
    defaultMessage: 'Installed extensions live in {dir}'
  },
  loading: {
    id: 'settings.extensions.loading',
    defaultMessage: 'Loading extensions…'
  },
  failed: {
    id: 'settings.extensions.failed',
    defaultMessage: 'Failed to load extensions.'
  },
  empty: {
    id: 'settings.extensions.empty',
    defaultMessage: 'No extensions found.'
  },
  loadFailed: {
    id: 'settings.extensions.loadFailed',
    defaultMessage: 'Failed to load: {error}'
  },
  builtin: {
    id: 'settings.extensions.builtin',
    defaultMessage: 'Built-in'
  },
  external: {
    id: 'settings.extensions.external',
    defaultMessage: 'External'
  },
  kindLsp: {
    id: 'settings.extensions.kindLsp',
    defaultMessage: 'Language server'
  },
  kindTheme: {
    id: 'settings.extensions.kindTheme',
    defaultMessage: 'Theme'
  },
  enableExtension: {
    id: 'settings.extensions.enableExtension',
    defaultMessage: 'Enable {name}'
  },
  installDialogTitle: {
    id: 'settings.extensions.installDialogTitle',
    defaultMessage: 'Add extension package'
  }
})

const DirCaption = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.mono};
`

const RowError = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`

export function ExtensionsPanel(): React.JSX.Element {
  const intl = useIntl()
  const { data: extensions, isLoading, isError } = useExtensions()
  const { data: dir } = useExtensionsDir()
  const setEnabled = useSetExtensionEnabled()
  const install = useInstallExtension()

  return (
    <Section>
      <SectionHeading
        title={<FormattedMessage {...messages.title} />}
        actions={
          <Button
            onClick={() =>
              install.mutate({
                dialogTitle: intl.formatMessage(messages.installDialogTitle)
              })
            }
            disabled={install.isPending}
          >
            <Plus size={14} />
            <FormattedMessage {...messages.addExtension} />
          </Button>
        }
      />
      {dir && (
        <DirCaption>
          <FormattedMessage {...messages.installedIn} values={{ dir: <code>{dir}</code> }} />
        </DirCaption>
      )}

      {isLoading && (
        <Message>
          <FormattedMessage {...messages.loading} />
        </Message>
      )}
      {isError && (
        <Message tone="danger">
          <FormattedMessage {...messages.failed} />
        </Message>
      )}
      {!isLoading && !isError && (extensions?.length ?? 0) === 0 && (
        <Message>
          <FormattedMessage {...messages.empty} />
        </Message>
      )}

      {!isLoading && !isError && (extensions?.length ?? 0) > 0 && (
        <List>
          {extensions?.map((ext) => (
            <ListRow key={ext.id} $padding={2}>
              <Stack $gap={1}>
                <Inline $gap={2}>
                  <RowTitle $size="sm">{ext.displayName}</RowTitle>
                  <Badge $tone="muted">
                    <FormattedMessage
                      {...(ext.kind === 'lsp' ? messages.kindLsp : messages.kindTheme)}
                    />
                  </Badge>
                  <Badge $tone={ext.source === 'builtin' ? 'muted' : undefined}>
                    <FormattedMessage
                      {...(ext.source === 'builtin' ? messages.builtin : messages.external)}
                    />
                  </Badge>
                </Inline>
                {ext.error && (
                  <RowError>
                    <FormattedMessage {...messages.loadFailed} values={{ error: ext.error }} />
                  </RowError>
                )}
              </Stack>
              <Checkbox
                checked={ext.enabled}
                disabled={Boolean(ext.error) || setEnabled.isPending}
                label={intl.formatMessage(messages.enableExtension, { name: ext.displayName })}
                onChange={(checked) => setEnabled.mutate({ id: ext.id, enabled: checked })}
              />
            </ListRow>
          ))}
        </List>
      )}
    </Section>
  )
}
