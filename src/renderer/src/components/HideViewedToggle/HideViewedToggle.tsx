import { EyeOff } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { IconButton } from '../IconButton';

const messages = defineMessages({
  hideViewed: {
    id: 'components.hideViewedToggle.hideViewed',
    defaultMessage: 'Hide viewed files',
  },
});

export function HideViewedToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (hide: boolean) => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <IconButton
      icon={EyeOff}
      label={intl.formatMessage(messages.hideViewed)}
      size={14}
      active={value}
      onClick={() => onChange(!value)}
    />
  );
}
