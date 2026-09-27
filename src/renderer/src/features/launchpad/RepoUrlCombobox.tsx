import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Combobox } from '../../components/Combobox'
import { repoFilterText, repoSearchQuery, repoUrl } from './repoUrl'
import type { ViewerRepo } from '@shared/ipc/schemas/project'

const messages = defineMessages({
  loading: {
    id: 'launchpad.repoCombobox.loading',
    defaultMessage: 'Loading repositories…'
  },
  empty: {
    id: 'launchpad.repoCombobox.empty',
    defaultMessage: 'No matching repositories — typed URLs are still accepted'
  }
})

interface RepoUrlComboboxProps {
  value: string
  onChange: (value: string) => void
  repos: readonly ViewerRepo[]
  loading?: boolean
  placeholder?: string
}

export function RepoUrlCombobox({
  value,
  onChange,
  repos,
  loading,
  placeholder
}: RepoUrlComboboxProps): React.JSX.Element {
  const intl = useIntl()

  return (
    <Combobox<ViewerRepo>
      items={repos}
      value={null}
      freeText={{ text: value, onTextChange: onChange, searchText: repoSearchQuery(value) }}
      onSelect={(repo) => repo && onChange(repoUrl(repo))}
      getKey={repoUrl}
      getLabel={repoFilterText}
      loading={loading}
      loadingLabel={intl.formatMessage(messages.loading)}
      emptyLabel={intl.formatMessage(messages.empty)}
      placeholder={placeholder}
    />
  )
}
