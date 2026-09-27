import styled from 'styled-components'
import { PrTarget } from './PrTarget'
import { CommitTarget } from './CommitTarget'
import { PathTarget } from './PathTarget'
import { useTargetCheckoutEffect } from './useTargetCheckout'
import { usePersistTargeting } from './usePersistTargeting'
import { Grid } from 'react-feather'
import { IconButton } from '../../components/IconButton'
import { Ellipsis } from '../../components/Ellipsis'
import { useIndexStatus } from '../../queries/projects'
import { useAppDispatch, useAppState } from '../../state/AppContext'

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
  const { pending } = useTargetCheckoutEffect()
  usePersistTargeting()
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { data: index } = useIndexStatus(state.projectId ?? '')

  return (
    <Bar>
      <IconButton
        icon={Grid}
        label="Projects"
        onClick={() => dispatch({ type: 'project/close' })}
      />
      <PrTarget />
      <CommitTarget />
      <PathTarget />
      {pending && <Status>Checking out…</Status>}
      <Spacer />
      {index?.state === 'indexing' && <Status>Indexing…</Status>}
    </Bar>
  )
}
