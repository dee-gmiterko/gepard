import { defineMessages, FormattedMessage } from 'react-intl';
import type { ExtensionKind } from '@gepard/common';
import { Badge } from '../../components/Badge';

const messages = defineMessages({
  kindLsp: {
    id: 'settings.extensions.kindLsp',
    defaultMessage: 'Language server',
  },
  kindGrammar: {
    id: 'settings.extensions.kindGrammar',
    defaultMessage: 'Grammar',
  },
  kindTheme: {
    id: 'settings.extensions.kindTheme',
    defaultMessage: 'Theme',
  },
  kindLocale: {
    id: 'settings.extensions.kindLocale',
    defaultMessage: 'Locale',
  },
});

const kindMessages = {
  lsp: messages.kindLsp,
  grammar: messages.kindGrammar,
  theme: messages.kindTheme,
  locale: messages.kindLocale,
} as const;

export function ExtensionKindBadge({ kind }: { kind: ExtensionKind }): React.JSX.Element {
  return (
    <Badge $tone="muted">
      <FormattedMessage {...kindMessages[kind]} />
    </Badge>
  );
}
