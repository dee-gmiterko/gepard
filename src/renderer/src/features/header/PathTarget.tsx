import { useMemo, useState } from 'react'
import { Folder, X } from 'react-feather'
import styled from 'styled-components'
import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Combobox } from '../../components/Combobox'
import { IconField } from '../../components/IconField'
import { IconButton } from '../../components/IconButton'
import { useChangedFiles, useTree } from '../../queries/files'
import { useCurrentHead } from '../../queries/projects'
import { useAppDispatch, useAppState } from '../../state/AppContext'
import { activeTargetRef, folderSourcePaths, foldersOf } from '../../state/selectors'

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

export function PathTarget(): React.JSX.Element {
  const intl = useIntl()
  const state = useAppState()
  const dispatch = useAppDispatch()
  const projectId = state.projectId ?? ''
  const head = useCurrentHead(state.projectId)
  const tree = useTree(projectId, head ?? '')
  const changed = useChangedFiles(projectId, state.checkout?.base ?? '', state.checkout?.head ?? '')
  const scoped = activeTargetRef(state.targeting) !== null

  const folders = useMemo(() => {
    const changedPaths = changed.data?.map((f) => f.path)
    const source = folderSourcePaths(state.targeting, changedPaths, tree.data ?? [])
    return foldersOf(source)
  }, [state.targeting, changed.data, tree.data])
  const isFetching = scoped ? changed.isFetching : tree.isFetching

  const [text, setText] = useState(state.targeting.path ?? '')
  const [lastCommitted, setLastCommitted] = useState(state.targeting.path)
  if (state.targeting.path !== lastCommitted) {
    setLastCommitted(state.targeting.path)
    setText(state.targeting.path ?? '')
  }

  function commit(raw: string): void {
    const path = raw.trim() || null
    setLastCommitted(path)
    setText(path ?? '')
    dispatch({ type: 'target/path', path })
  }

  return (
    <IconField icon={Folder} width={220}>
      <KeydownCatcher
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.defaultPrevented) commit(text)
        }}
      >
        <Combobox<string>
          items={folders}
          value={null}
          getKey={(f) => f}
          getLabel={(f) => f}
          loading={isFetching}
          placeholder={intl.formatMessage(messages.placeholder)}
          onSelect={(folder) => commit(folder ?? '')}
          freeText={{ text, onTextChange: setText }}
        />
      </KeydownCatcher>
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
