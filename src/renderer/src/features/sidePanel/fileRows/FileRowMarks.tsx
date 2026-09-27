import styled from 'styled-components'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../../i18n/defineMessages'
import { useAppState } from '../../../state/AppContext'
import { useSetViewed } from '../../../queries/comments'
import { Checkbox } from '../../../components/Checkbox'
import { Inline } from '../../../components/Layout'
import type { RowData } from './rowData'

const messages = defineMessages({
  added: {
    id: 'sidePanel.fileRowMarks.added',
    defaultMessage: '+{count}'
  },
  removed: {
    id: 'sidePanel.fileRowMarks.removed',
    defaultMessage: '-{count}'
  },
  viewed: {
    id: 'sidePanel.fileRowMarks.viewed',
    defaultMessage: 'Viewed'
  }
})

const Marks = styled(Inline)`
  flex-shrink: 0;
`

const Counts = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-family: ${({ theme }) => theme.font.mono};
`

const Add = styled.span`
  color: ${({ theme }) => theme.colors.diffAddFg};
`

const Del = styled.span`
  color: ${({ theme }) => theme.colors.diffDelFg};
`

export function FileRowMarks({
  data,
  paths
}: {
  data: RowData
  paths: string[]
}): React.JSX.Element | null {
  const intl = useIntl()
  const state = useAppState()
  const { mutate: setViewed } = useSetViewed()
  const hasCounts = data.additions > 0 || data.deletions > 0
  const hasViewed = state.targeting.pr !== null && data.totalCount > 0
  if (!hasCounts && !hasViewed) return null

  return (
    <Marks>
      {hasCounts && (
        <Counts>
          {data.additions > 0 && (
            <Add>
              <FormattedMessage {...messages.added} values={{ count: data.additions }} />
            </Add>
          )}
          {data.deletions > 0 && (
            <Del>
              <FormattedMessage {...messages.removed} values={{ count: data.deletions }} />
            </Del>
          )}
        </Counts>
      )}
      {hasViewed && (
        <Checkbox
          checked={data.viewedCount === data.totalCount}
          indeterminate={data.viewedCount > 0 && data.viewedCount < data.totalCount}
          ariaLabel={intl.formatMessage(messages.viewed)}
          onChange={(checked) => setViewed({ paths, viewed: checked })}
        />
      )}
    </Marks>
  )
}
