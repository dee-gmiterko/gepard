import { Layers, List } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { IconButton } from '../IconButton';

export type ViewMode = 'tree' | 'flat';

const messages = defineMessages({
  tree: {
    id: 'components.viewModeToggle.tree',
    defaultMessage: 'Tree view',
  },
  flat: {
    id: 'components.viewModeToggle.flat',
    defaultMessage: 'Flat view',
  },
});

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <span>
      <IconButton
        icon={Layers}
        label={intl.formatMessage(messages.tree)}
        size={14}
        active={value === 'tree'}
        onClick={() => onChange('tree')}
      />
      <IconButton
        icon={List}
        label={intl.formatMessage(messages.flat)}
        size={14}
        active={value === 'flat'}
        onClick={() => onChange('flat')}
      />
    </span>
  );
}
