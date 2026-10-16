import { defineMessages, FormattedMessage } from 'react-intl';
import { List, ListRow } from '../../components/List';
import { Message } from '../../components/Message';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { useExtensionCatalog, useInstallExtension } from '../../queries/extensions';
import { ExtensionsCatalogRow } from './ExtensionsCatalogRow';

const messages = defineMessages({
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
});

export function ExtensionsCatalogSection(): React.JSX.Element {
  const { data, isLoading, isError } = useExtensionCatalog();
  const install = useInstallExtension();
  const entries = (data?.entries ?? []).filter(
    (entry) => entry.installedVersion === null && entry.installedSource?.kind !== 'builtin',
  );

  return (
    <Section $flush>
      <SectionHeading title={<FormattedMessage {...messages.catalogTitle} />} />
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
            <ExtensionsCatalogRow
              key={entry.name}
              entry={entry}
              installing={
                install.isPending &&
                install.variables?.kind === 'github-release' &&
                install.variables.path === entry.path
              }
              disabled={install.isPending}
              onInstall={() =>
                install.mutate({
                  kind: 'github-release',
                  repository: entry.repository,
                  path: entry.path,
                })
              }
            />
          ))
        )}
      </List>
    </Section>
  );
}
