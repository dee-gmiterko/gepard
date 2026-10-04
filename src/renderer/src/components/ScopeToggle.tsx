import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { SearchScope } from '@gepard/common';
import { SegmentedControl } from './SegmentedControl';

const messages = defineMessages({
  ariaLabel: {
    id: 'components.scopeToggle.ariaLabel',
    defaultMessage: 'Search scope',
  },
  all: {
    id: 'components.scopeToggle.all',
    defaultMessage: 'All files',
  },
  targetedOnly: {
    id: 'components.scopeToggle.targetedOnly',
    defaultMessage: 'Targeted only',
  },
});

export function ScopeToggle({
  value,
  onChange,
}: {
  value: SearchScope;
  onChange: (scope: SearchScope) => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <SegmentedControl
      label={intl.formatMessage(messages.ariaLabel)}
      value={value}
      options={[
        { value: 'all', label: <FormattedMessage {...messages.all} /> },
        { value: 'targeted', label: <FormattedMessage {...messages.targetedOnly} /> },
      ]}
      onChange={onChange}
    />
  );
}
