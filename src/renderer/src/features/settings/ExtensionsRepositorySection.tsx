import { useState } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { isRepositoryInput, splitRepositorySource } from '@gepard/common';
import { Button } from '../../components/Button';
import { Message } from '../../components/Message';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { TextInput } from '../../components/TextInput';
import { useInstallExtension } from '../../queries/extensions';

const messages = defineMessages({
  catalogInstalling: {
    id: 'settings.extensions.repo.installing',
    defaultMessage: 'Installing…',
  },
  repoTitle: {
    id: 'settings.extensions.repo.title',
    defaultMessage: 'Install from GitHub',
  },
  repoHint: {
    id: 'settings.extensions.repo.hint',
    defaultMessage:
      'Installs the extension archive attached to the latest release of a GitHub repository. For a repository with several extensions, add the path of the extension inside it after owner/repo.',
  },
  repoSource: {
    id: 'settings.extensions.repo.source',
    defaultMessage: 'Repository',
  },
  repoSourcePlaceholder: {
    id: 'settings.extensions.repo.sourcePlaceholder',
    defaultMessage: 'owner/repo or owner/repo/extensions/lsp/name',
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
  const [source, setSource] = useState('');
  const { repository, path } = splitRepositorySource(source);
  const valid = isRepositoryInput(repository);

  return (
    <Section $flush>
      <SectionHeading title={<FormattedMessage {...messages.repoTitle} />} />
      <Message tone="subtle" layout="inline">
        <FormattedMessage {...messages.repoHint} />
      </Message>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || install.isPending) return;
          install.mutate(
            { kind: 'github-release', repository, path },
            { onSuccess: () => setSource('') },
          );
        }}
      >
        <FieldLabel>
          <FormattedMessage {...messages.repoSource} />
          <TextInput
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={intl.formatMessage(messages.repoSourcePlaceholder)}
            spellCheck={false}
          />
        </FieldLabel>
        <FormActions>
          <Button type="submit" disabled={!valid || install.isPending}>
            <FormattedMessage
              {...(install.isPending ? messages.catalogInstalling : messages.repoInstall)}
            />
          </Button>
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
