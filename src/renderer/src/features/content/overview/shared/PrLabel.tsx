import { defineMessages, FormattedMessage } from 'react-intl';

const messages = defineMessages({
  prLabel: { id: 'content.overview.prLabel', defaultMessage: '#{number} {title}' },
});

export function PrLabel({ number, title }: { number: number; title: string }): React.JSX.Element {
  return <FormattedMessage {...messages.prLabel} values={{ number, title }} />;
}
