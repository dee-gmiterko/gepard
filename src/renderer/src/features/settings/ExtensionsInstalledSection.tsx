import styled from 'styled-components';
import { Plus } from 'react-feather';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { List, ListRow } from '../../components/List';
import { Message } from '../../components/Message';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import {
  useExtensions,
  useExtensionsDir,
  useInstallExtension,
  useSetExtensionEnabled,
} from '../../queries/extensions';
import { ExtensionsRow } from './ExtensionsRow';
import { messages } from './ExtensionsMessages';

const DirCaption = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.mono};
`;

export function ExtensionsInstalledSection(): React.JSX.Element {
  const intl = useIntl();
  const { data: extensions, isLoading, isError } = useExtensions();
  const { data: dir } = useExtensionsDir();
  const setEnabled = useSetExtensionEnabled();
  const install = useInstallExtension();

  return (
    <Section>
      <SectionHeading
        title={<FormattedMessage {...messages.title} />}
        actions={
          <Button
            onClick={() =>
              install.mutate({
                kind: 'local',
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
            <ExtensionsRow
              key={ext.id}
              ext={ext}
              disabled={setEnabled.isPending}
              onToggle={(enabled) => setEnabled.mutate({ id: ext.id, enabled })}
            />
          ))
        )}
      </List>
    </Section>
  );
}
