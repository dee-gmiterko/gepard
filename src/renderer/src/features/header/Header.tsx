// Header panel - targeting (spec): a series of fuzzy search select boxes
// entering PR, commit, folder. Owns the side effects of a target change
// (useTargetCheckoutEffect: checkout + sync, see that file).
import styled from 'styled-components'
import { PrTarget } from './PrTarget'
import { CommitTarget } from './CommitTarget'
import { FolderTarget } from './FolderTarget'
import { useTargetCheckoutEffect } from './useTargetCheckout'
import { Grid } from 'react-feather'
import { IconButton } from '../../components/IconButton'
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

const Status = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Spacer = styled.div`
  flex: 1;
`

export function Header(): React.JSX.Element {
  // Checkout/sync failures are reported to the unified toast surface by the
  // global mutation cache (main.tsx); this only needs the pending flag now.
  const { pending } = useTargetCheckoutEffect()
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
      <FolderTarget />
      {pending && <Status>Checking out…</Status>}
      <Spacer />
      {index?.state === 'indexing' && <Status>Indexing…</Status>}
    </Bar>
  )
}
