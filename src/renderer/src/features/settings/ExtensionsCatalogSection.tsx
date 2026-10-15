import { FormattedMessage, useIntl } from 'react-intl';
import { List, ListRow } from '../../components/List';
import { Message } from '../../components/Message';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { describeError, formatErrorText } from '../../errors/errorMessage';
import { useExtensionCatalog, useInstallExtension } from '../../queries/extensions';
import { ExtensionsCatalogRow } from './ExtensionsCatalogRow';
import { messages } from './ExtensionsMessages';

export function ExtensionsCatalogSection(): React.JSX.Element {
  const intl = useIntl();
  const { data, isLoading, isError } = useExtensionCatalog();
  const install = useInstallExtension();
  const entries = data?.entries ?? [];

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.catalogTitle} />} />
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
