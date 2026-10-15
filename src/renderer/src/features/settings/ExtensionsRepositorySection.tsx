import { useState } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { isRepositoryInput } from '@gepard/common';
import { Button } from '../../components/Button';
import { Message } from '../../components/Message';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { TextInput } from '../../components/TextInput';
import { formatDescribedError } from '../../errors/errorMessage';
import { useInstallExtension } from '../../queries/extensions';

const messages = defineMessages({
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

export function ExtensionsRepositorySection(): React.JSX.Element {
  const intl = useIntl();
  const install = useInstallExtension();
  const [repository, setRepository] = useState('');
  const [path, setPath] = useState('');
  const valid = isRepositoryInput(repository);

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
            { kind: 'github-release', repository: repository.trim(), path: path.trim() || null },
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
              {formatDescribedError(intl, install.error)}
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
