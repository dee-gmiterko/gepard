import { FormattedMessage } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { PathLabel } from '../PathLabel'

const messages = defineMessages({
  pathAndLine: {
    id: 'components.pathAndLine.pathAndLine',
    defaultMessage: '{path}:{line}'
  }
})

export function PathAndLine({
  path,
  line
}: {
  path: string
  line: number | null
}): React.JSX.Element {
  return (
    <PathLabel>
      {line != null ? <FormattedMessage {...messages.pathAndLine} values={{ path, line }} /> : path}
    </PathLabel>
  )
}
