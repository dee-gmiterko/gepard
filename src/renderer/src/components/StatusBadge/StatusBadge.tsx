import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Badge } from '../Badge'

const messages = defineMessages({
  outdated: {
    id: 'components.statusBadge.outdated',
    defaultMessage: 'outdated'
  },
  resolved: {
    id: 'components.statusBadge.resolved',
    defaultMessage: 'resolved'
  }
})

export function OutdatedBadge(): React.JSX.Element {
  return (
    <Badge $tone="warning">
      <FormattedMessage {...messages.outdated} />
    </Badge>
  )
}

export function ResolvedBadge(): React.JSX.Element {
  return (
    <Badge $tone="success">
      <FormattedMessage {...messages.resolved} />
    </Badge>
  )
}
