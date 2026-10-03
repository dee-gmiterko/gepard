import { defineMessages, FormattedMessage } from 'react-intl';

const messages = defineMessages({
  size: {
    id: 'content.overview.size',
    defaultMessage: '{files, plural, one {# file} other {# files}}',
  },
});

export function FileCount({ files }: { files: number }): React.JSX.Element {
  return <FormattedMessage {...messages.size} values={{ files }} />;
}
