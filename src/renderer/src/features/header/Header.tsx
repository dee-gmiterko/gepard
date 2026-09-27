import styled from 'styled-components'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { PrTarget } from './PrTarget'
import { CommitTarget } from './CommitTarget'
import { PathTarget } from './PathTarget'
import { useTargetingEffects } from './useTargetingEffects'
import { Grid } from 'react-feather'
import { IconButton } from '../../components/IconButton'
import { Ellipsis } from '../../components/Ellipsis'
import { Inline } from '../../components/Layout'
import { useIndexStatus } from '../../queries/projects'
import { useAppDispatch } from '../../state/AppContext'

const messages = defineMessages({
  projects: {
    id: 'header.projects',
    defaultMessage: 'Projects'
  },
  checkingOut: {
    id: 'header.checkingOut',
    defaultMessage: 'Checking out…'
  },
  indexing: {
    id: 'header.indexing',
    defaultMessage: 'Indexing…'
  }
})

const Bar = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  height: 40px;
  padding: 0 ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.bgSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Status = styled(Ellipsis)`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`

const Spacer = styled.div`
  flex: 1;
`

export function Header(): React.JSX.Element {
  const intl = useIntl()
  const { pending } = useTargetingEffects()
  const dispatch = useAppDispatch()
  const { data: index } = useIndexStatus()

  return (
    <Bar>
      <IconButton
        icon={Grid}
        label={intl.formatMessage(messages.projects)}
        onClick={() => dispatch({ type: 'project/close' })}
      />
      <Inline $gap={5}>
        <PrTarget />
        <CommitTarget />
        <PathTarget />
      </Inline>
      {pending && (
        <Status>
          <FormattedMessage {...messages.checkingOut} />
        </Status>
      )}
      <Spacer />
      {index?.state === 'indexing' && (
        <Status>
          <FormattedMessage {...messages.indexing} />
        </Status>
      )}
    </Bar>
  )
}
