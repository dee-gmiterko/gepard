import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';
import { List, ListRow, RowTitle } from '../../components/List';
import { Badge } from '../../components/Badge';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { Caption } from '../../components/Caption';
import { keyBindings } from '../../keyboard/bindings';

const messages = defineMessages({
  title: {
    id: 'settings.keybindings.title',
    defaultMessage: 'Controls',
  },
  readOnly: {
    id: 'settings.keybindings.readOnly',
    defaultMessage: 'Shortcuts are fixed for now; rebinding is not yet supported.',
  },
});

const Key = styled(Badge)`
  font-family: ${({ theme }) => theme.font.mono};
`;

const Hint = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

export function KeybindingsPanel(): React.JSX.Element {
  const intl = useIntl();

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Hint>
        <FormattedMessage {...messages.readOnly} />
      </Hint>
      <List>
        {keyBindings.map((binding) => (
          <ListRow key={binding.id}>
            <RowTitle $size="sm">{intl.formatMessage(binding.label)}</RowTitle>
            <Key>{binding.keyLabel}</Key>
          </ListRow>
        ))}
      </List>
    </Section>
  );
}
