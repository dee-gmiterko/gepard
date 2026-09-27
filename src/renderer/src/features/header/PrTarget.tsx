import { useCallback, useMemo, useState } from 'react'
import { GitPullRequest, Plus } from 'react-feather'
import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Combobox } from '../../components/Combobox'
import { IconButton } from '../../components/IconButton'
import { IconField } from '../../components/IconField'
import { Inline } from '../../components/Layout'
import { usePrList } from '../../queries/prs'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { NewPrModal } from './NewPrModal'
import type { PrListItem } from '@shared/ipc/schemas/pr'

const messages = defineMessages({
  placeholder: {
    id: 'header.prTarget.placeholder',
    defaultMessage: 'PR…'
  },
  newPullRequest: {
    id: 'header.prTarget.newPullRequest',
    defaultMessage: 'New pull request'
  },
  prLabel: {
    id: 'header.prTarget.prLabel',
    defaultMessage: '#{number} {title}'
  },
  unresolvedPrLabel: {
    id: 'header.prTarget.unresolvedLabel',
    defaultMessage: '#{number}'
  }
})

function prFilterText(pr: PrListItem): string {
  return [
    `#${pr.number}`,
    pr.title,
    pr.author.login,
    pr.headRefName,
    ...pr.labels.map((l) => l.name)
  ].join(' ')
}

export function PrTarget(): React.JSX.Element {
  const intl = useIntl()
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''

  const commit = state.targeting.commit ?? undefined
  const path = state.targeting.path ?? undefined
  const { data: prs, isFetching } = usePrList(projectId, undefined, commit, path)

  const [selected, setSelected] = useState<PrListItem | null>(null)
  const [newPrOpen, setNewPrOpen] = useState(false)

  const getPrLabel = useCallback(
    (pr: PrListItem) =>
      intl.formatMessage(messages.prLabel, { number: pr.number, title: pr.title }),
    [intl]
  )

  const value = useMemo(() => {
    if (state.targeting.pr === null) return null
    if (selected?.number === state.targeting.pr) return selected
    return prs?.find((pr) => pr.number === state.targeting.pr) ?? selected
  }, [state.targeting.pr, selected, prs])

  const unresolvedLabel =
    value === null && state.targeting.pr !== null
      ? intl.formatMessage(messages.unresolvedPrLabel, { number: state.targeting.pr })
      : undefined

  return (
    <Inline $gap={1}>
      <IconField icon={GitPullRequest} width={280}>
        <Combobox<PrListItem>
          items={prs ?? []}
          value={value}
          getKey={(pr) => String(pr.number)}
          getLabel={getPrLabel}
          getFilterText={prFilterText}
          loading={isFetching}
          placeholder={intl.formatMessage(messages.placeholder)}
          unresolvedLabel={unresolvedLabel}
          onSelect={(pr) => {
            setSelected(pr)
            dispatch({ type: 'target/pr', pr: pr?.number ?? null })
          }}
        />
      </IconField>
      <IconButton
        icon={Plus}
        label={intl.formatMessage(messages.newPullRequest)}
        onClick={() => setNewPrOpen(true)}
      />
      {newPrOpen && (
        <NewPrModal
          projectId={projectId}
          onClose={() => setNewPrOpen(false)}
          onCreated={(pr) => {
            setSelected(pr)
            dispatch({ type: 'target/pr', pr: pr.number })
            setNewPrOpen(false)
          }}
        />
      )}
    </Inline>
  )
}
