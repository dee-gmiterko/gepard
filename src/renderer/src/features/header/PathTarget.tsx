import { useMemo, useState } from 'react'
import { Folder, X } from 'react-feather'
import styled from 'styled-components'
import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { IconButton } from '../../components/IconButton'
import { useChangedFiles, useTree } from '../../queries/files'
import { useAppState } from '../../state/AppContext'
import { useTargetActions } from './useTargetActions'
import { activeTargetRef, folderSourcePaths } from '../../state/selectors'
import { foldersOf } from '../../helpers/paths'

const messages = defineMessages({
  placeholder: {
    id: 'header.pathTarget.placeholder',
    defaultMessage: 'Path…'
  },
  clear: {
    id: 'header.pathTarget.clear',
    defaultMessage: 'Clear'
  }
})

const KeydownCatcher = styled.div`
  display: contents;
`

interface PathTargetInputProps {
  committed: string | null
  folders: string[]
  isFetching: boolean
  placeholder: string
  onCommit: (raw: string) => void
}

function PathTargetInput({
  committed,
  folders,
  isFetching,
  placeholder,
  onCommit
}: PathTargetInputProps): React.JSX.Element {
  const [text, setText] = useState(committed ?? '')

  return (
    <KeydownCatcher
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.defaultPrevented) onCommit(text)
      }}
    >
      <Combobox<string>
        items={folders}
        value={null}
        getKey={(f) => f}
        getLabel={(f) => f}
        loading={isFetching}
        placeholder={placeholder}
        onSelect={(folder) => onCommit(folder ?? '')}
        freeText={{ text, onTextChange: setText }}
      />
    </KeydownCatcher>
  )
}

export function PathTarget(): React.JSX.Element {
  const intl = useIntl()
  const state = useAppState()
  const { setPath } = useTargetActions()
  const tree = useTree()
  const changed = useChangedFiles()
  const scoped = activeTargetRef(state.targeting) !== null

  const folders = useMemo(() => {
    const changedPaths = changed.data?.map((f) => f.path)
    const source = folderSourcePaths(state.targeting, changedPaths, tree.data ?? [])
    return foldersOf(source)
  }, [state.targeting, changed.data, tree.data])
  const isFetching = scoped ? changed.isFetching : tree.isFetching

  function commit(raw: string): void {
    setPath(raw.trim() || null)
  }

  return (
    <IconField icon={Folder} width={220}>
      <PathTargetInput
        key={state.targeting.path ?? ''}
        committed={state.targeting.path}
        folders={folders}
        isFetching={isFetching}
        placeholder={intl.formatMessage(messages.placeholder)}
        onCommit={commit}
      />
      {state.targeting.path !== null && (
        <IconButton
          icon={X}
          label={intl.formatMessage(messages.clear)}
          size={12}
          onClick={() => commit('')}
        />
      )}
    </IconField>
  )
}
