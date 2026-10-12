import { useState } from 'react';
import styled from 'styled-components';
import { Plus } from 'react-feather';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { CatalogEntryStatus } from '@gepard/common';
import { Checkbox } from '../../components/Checkbox';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Message } from '../../components/Message';
import { List, ListRow, RowTitle } from '../../components/List';
import { Stack, Inline } from '../../components/Layout';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { TextInput } from '../../components/TextInput';
import { describeError, formatErrorText } from '../../errors/errorMessage';
import { catalogAction, isRepositoryInputValid } from '../../helpers/extensionCatalog';
import {
  useExtensionCatalog,
  useExtensions,
  useExtensionsDir,
  useInstallExtension,
  useInstallFromCatalog,
  useInstallFromRepo,
  useSetExtensionEnabled,
} from '../../queries/extensions';

const messages = defineMessages({
  title: {
    id: 'settings.extensions.title',
    defaultMessage: 'Extensions',
  },
  addExtension: {
    id: 'settings.extensions.addExtension',
    defaultMessage: 'Add extension',
  },
  installedIn: {
    id: 'settings.extensions.installedIn',
    defaultMessage: 'Installed extensions live in {dir}',
  },
  loading: {
    id: 'settings.extensions.loading',
    defaultMessage: 'Loading extensions…',
  },
  failed: {
    id: 'settings.extensions.failed',
    defaultMessage: 'Failed to load extensions.',
  },
  empty: {
    id: 'settings.extensions.empty',
    defaultMessage: 'No extensions found.',
  },
  loadFailed: {
    id: 'settings.extensions.loadFailed',
    defaultMessage: 'Failed to load: {error}',
  },
  builtin: {
    id: 'settings.extensions.builtin',
    defaultMessage: 'Built-in',
  },
  external: {
    id: 'settings.extensions.external',
    defaultMessage: 'External',
  },
  kindLsp: {
    id: 'settings.extensions.kindLsp',
    defaultMessage: 'Language server',
  },
  kindGrammar: {
    id: 'settings.extensions.kindGrammar',
    defaultMessage: 'Grammar',
  },
  kindTheme: {
    id: 'settings.extensions.kindTheme',
    defaultMessage: 'Theme',
  },
  kindLocale: {
    id: 'settings.extensions.kindLocale',
    defaultMessage: 'Locale',
  },
  enableExtension: {
    id: 'settings.extensions.enableExtension',
    defaultMessage: 'Enable {name}',
  },
  installDialogTitle: {
    id: 'settings.extensions.installDialogTitle',
    defaultMessage: 'Add extension package',
  },
  version: {
    id: 'settings.extensions.version',
    defaultMessage: 'v{version}',
  },
  catalogTitle: {
    id: 'settings.extensions.catalog.title',
    defaultMessage: 'Available extensions',
  },
  catalogLoading: {
    id: 'settings.extensions.catalog.loading',
    defaultMessage: 'Loading available extensions…',
  },
  catalogFailed: {
    id: 'settings.extensions.catalog.failed',
    defaultMessage: 'Failed to load the list of available extensions.',
  },
  catalogEmpty: {
    id: 'settings.extensions.catalog.empty',
    defaultMessage: 'No extensions are available.',
  },
  catalogOffline: {
    id: 'settings.extensions.catalog.offline',
    defaultMessage: 'Showing the list bundled with this version of Gepard; it may be out of date.',
  },
  catalogLatest: {
    id: 'settings.extensions.catalog.latest',
    defaultMessage: 'Latest v{version}',
  },
  catalogInstalled: {
    id: 'settings.extensions.catalog.installed',
    defaultMessage: 'Installed v{version}',
  },
  catalogInstall: {
    id: 'settings.extensions.catalog.install',
    defaultMessage: 'Install',
  },
  catalogUpdate: {
    id: 'settings.extensions.catalog.update',
    defaultMessage: 'Update',
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
  repoTitle: {
    id: 'settings.extensions.repo.title',
    defaultMessage: 'Install from GitHub',
  },
  repoHint: {
    id: 'settings.extensions.repo.hint',
    defaultMessage:
      'Installs the extension archive attached to the latest release of a GitHub repository. For a repository with several extensions, give the path of the extension inside it.',
  },
  repoRepository: {
    id: 'settings.extensions.repo.repository',
    defaultMessage: 'Repository (owner/repo)',
  },
  repoPath: {
    id: 'settings.extensions.repo.path',
    defaultMessage: 'Path within the repository (optional)',
  },
  repoRepositoryPlaceholder: {
    id: 'settings.extensions.repo.repositoryPlaceholder',
    defaultMessage: 'owner/repo',
  },
  repoPathPlaceholder: {
    id: 'settings.extensions.repo.pathPlaceholder',
    defaultMessage: 'extensions/lsp/name',
  },
  repoInstall: {
    id: 'settings.extensions.repo.install',
    defaultMessage: 'Install from repository',
  },
  repoInstalled: {
    id: 'settings.extensions.repo.installed',
    defaultMessage: 'Extension installed.',
  },
});

const actionMessages = {
  install: messages.catalogInstall,
  update: messages.catalogUpdate,
  upToDate: messages.catalogUpToDate,
  builtin: messages.builtin,
  unsupported: messages.catalogUnsupported,
} as const;

const kindMessages = {
  lsp: messages.kindLsp,
  grammar: messages.kindGrammar,
  theme: messages.kindTheme,
  locale: messages.kindLocale,
} as const;

const DirCaption = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.mono};
`;

const RowError = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const FormActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

function CatalogRow({
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
  const actionable = action === 'install' || action === 'update';
  return (
    <ListRow $padding={2}>
      <Stack $gap={1}>
        <Inline $gap={2}>
          <RowTitle $size="sm">{entry.displayName}</RowTitle>
          <Badge $tone="muted">
            <FormattedMessage {...kindMessages[entry.kind]} />
          </Badge>
          <Caption>
            <FormattedMessage
              {...messages.catalogLatest}
              values={{ version: entry.latestVersion }}
            />
          </Caption>
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
      {actionable ? (
        <Button
          variant={action === 'update' ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={onInstall}
        >
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

function CatalogSection(): React.JSX.Element {
  const intl = useIntl();
  const { data, isLoading, isError } = useExtensionCatalog();
  const install = useInstallFromCatalog();
  const entries = data?.entries ?? [];

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.catalogTitle} />} />
      {data?.source === 'builtin' && (
        <Message tone="subtle" layout="inline">
          <FormattedMessage {...messages.catalogOffline} />
        </Message>
      )}
      {install.isError && (
        <Message tone="danger" layout="inline">
          {formatErrorText(intl, describeError(install.error).message)}
        </Message>
      )}
      <List>
        {isLoading ? (
          <ListRow $padding={2}>
            <Message layout="inline">
              <FormattedMessage {...messages.catalogLoading} />
            </Message>
          </ListRow>
        ) : isError ? (
          <ListRow $padding={2}>
            <Message tone="danger" layout="inline">
              <FormattedMessage {...messages.catalogFailed} />
            </Message>
          </ListRow>
        ) : entries.length === 0 ? (
          <ListRow $padding={2}>
            <Message layout="inline">
              <FormattedMessage {...messages.catalogEmpty} />
            </Message>
          </ListRow>
        ) : (
          entries.map((entry) => (
            <CatalogRow
              key={entry.name}
              entry={entry}
              installing={install.isPending && install.variables?.name === entry.name}
              disabled={install.isPending}
              onInstall={() => install.mutate({ name: entry.name })}
            />
          ))
        )}
      </List>
    </Section>
  );
}

function RepositorySection(): React.JSX.Element {
  const intl = useIntl();
  const install = useInstallFromRepo();
  const [repository, setRepository] = useState('');
  const [path, setPath] = useState('');
  const valid = isRepositoryInputValid(repository);

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.repoTitle} />} />
      <Message tone="subtle" layout="inline">
        <FormattedMessage {...messages.repoHint} />
      </Message>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || install.isPending) return;
          install.mutate(
            { repository: repository.trim(), path: path.trim() || null },
            { onSuccess: () => setRepository('') },
          );
        }}
      >
        <FieldLabel>
          <FormattedMessage {...messages.repoRepository} />
          <TextInput
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            placeholder={intl.formatMessage(messages.repoRepositoryPlaceholder)}
            spellCheck={false}
          />
        </FieldLabel>
        <FieldLabel>
          <FormattedMessage {...messages.repoPath} />
          <TextInput
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder={intl.formatMessage(messages.repoPathPlaceholder)}
            spellCheck={false}
          />
        </FieldLabel>
        <FormActions>
          <Button type="submit" disabled={!valid || install.isPending}>
            <FormattedMessage
              {...(install.isPending ? messages.catalogInstalling : messages.repoInstall)}
            />
          </Button>
          {install.isError && (
            <Message tone="danger" layout="inline">
              {formatErrorText(intl, describeError(install.error).message)}
            </Message>
          )}
          {install.isSuccess && !install.isPending && (
            <Message layout="inline">
              <FormattedMessage {...messages.repoInstalled} />
            </Message>
          )}
        </FormActions>
      </Form>
    </Section>
  );
}

export function ExtensionsPanel(): React.JSX.Element {
  const intl = useIntl();
  const { data: extensions, isLoading, isError } = useExtensions();
  const { data: dir } = useExtensionsDir();
  const setEnabled = useSetExtensionEnabled();
  const install = useInstallExtension();

  return (
    <>
      <Section>
        <SectionHeading
          title={<FormattedMessage {...messages.title} />}
          actions={
            <Button
              onClick={() =>
                install.mutate({
                  dialogTitle: intl.formatMessage(messages.installDialogTitle),
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

        <List>
          {isLoading ? (
            <ListRow $padding={2}>
              <Message layout="inline">
                <FormattedMessage {...messages.loading} />
              </Message>
            </ListRow>
          ) : isError ? (
            <ListRow $padding={2}>
              <Message tone="danger" layout="inline">
                <FormattedMessage {...messages.failed} />
              </Message>
            </ListRow>
          ) : (extensions?.length ?? 0) === 0 ? (
            <ListRow $padding={2}>
              <Message layout="inline">
                <FormattedMessage {...messages.empty} />
              </Message>
            </ListRow>
          ) : (
            extensions?.map((ext) => (
              <ListRow key={ext.id} $padding={2}>
                <Stack $gap={1}>
                  <Inline $gap={2}>
                    <RowTitle $size="sm">{ext.displayName}</RowTitle>
                    <Badge $tone="muted">
                      <FormattedMessage {...kindMessages[ext.kind]} />
                    </Badge>
                    <Badge $tone={ext.source === 'builtin' ? 'muted' : undefined}>
                      <FormattedMessage
                        {...(ext.source === 'builtin' ? messages.builtin : messages.external)}
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
                  disabled={Boolean(ext.error) || setEnabled.isPending}
                  ariaLabel={intl.formatMessage(messages.enableExtension, {
                    name: ext.displayName,
                  })}
                  onChange={(checked) => setEnabled.mutate({ id: ext.id, enabled: checked })}
                />
              </ListRow>
            ))
          )}
        </List>
      </Section>
      <CatalogSection />
      <RepositorySection />
    </>
  );
}
