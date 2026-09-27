import styled from 'styled-components'
import { Plus } from 'react-feather'
import { Checkbox } from '../../components/Checkbox'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Caption } from '../../components/Caption'
import { Message } from '../../components/Message'
import { List, ListRow } from '../../components/List'
import { Stack, Inline } from '../../components/Layout'
import {
  useExtensions,
  useExtensionsDir,
  useInstallExtension,
  useSetExtensionEnabled
} from '../../queries/extensions'

const Section = styled.section`
  margin-top: ${({ theme }) => theme.space[6]};
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[1]};
`

const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
`

const DirCaption = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.mono};
`

const RowName = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
`

const RowError = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`

export function ExtensionsPanel(): React.JSX.Element {
  const { data: extensions, isLoading, isError } = useExtensions()
  const { data: dir } = useExtensionsDir()
  const setEnabled = useSetExtensionEnabled()
  const install = useInstallExtension()

  return (
    <Section>
      <Header>
        <Title>Extensions</Title>
        <Button onClick={() => install.mutate()} disabled={install.isPending}>
          <Plus size={14} />
          Add extension
        </Button>
      </Header>
      {dir && (
        <DirCaption>
          Installed extensions live in <code>{dir}</code>
        </DirCaption>
      )}

      {isLoading && <Message>Loading extensions…</Message>}
      {isError && <Message tone="danger">Failed to load extensions.</Message>}
      {!isLoading && !isError && (extensions?.length ?? 0) === 0 && (
        <Message>No extensions found.</Message>
      )}

      {!isLoading && !isError && (extensions?.length ?? 0) > 0 && (
        <List>
          {extensions?.map((ext) => (
            <ListRow key={ext.id} $padding={2}>
              <Stack $gap={1}>
                <Inline $gap={2}>
                  <RowName>{ext.displayName}</RowName>
                  <Badge $tone={ext.source === 'builtin' ? 'muted' : undefined}>
                    {ext.source === 'builtin' ? 'Built-in' : 'External'}
                  </Badge>
                </Inline>
                {ext.error && <RowError>{ext.error}</RowError>}
              </Stack>
              <Checkbox
                checked={ext.enabled}
                disabled={Boolean(ext.error) || setEnabled.isPending}
                label={ext.enabled ? 'Enabled' : 'Disabled'}
                onChange={(checked) => setEnabled.mutate({ id: ext.id, enabled: checked })}
              />
            </ListRow>
          ))}
        </List>
      )}
    </Section>
  )
}
