import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styled from 'styled-components'
import { TextInput } from '../../components/TextInput'
import { Menu, MenuItem, MenuMessage } from '../../components/Menu'
import { HighlightedText } from '../../components/HighlightedText'
import { fuzzyRanges } from '../../components/Combobox'
import { repoFilterText, repoSearchQuery, repoUrl, suggestRepos } from './repoUrl'
import type { ViewerRepo } from '@shared/ipc/schemas/project'

export interface RepoUrlComboboxProps {
  value: string
  onChange: (value: string) => void
  repos: readonly ViewerRepo[]
  loading?: boolean
  placeholder?: string
  disabled?: boolean
}

const Container = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`

export function RepoUrlCombobox({
  value,
  onChange,
  repos,
  loading,
  placeholder,
  disabled
}: RepoUrlComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => suggestRepos(repos, value), [repos, value])
  const active = Math.min(highlight, Math.max(filtered.length - 1, 0))

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function pick(repo: ViewerRepo): void {
    onChange(repoUrl(repo))
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(Math.min(active + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(filtered[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Container ref={containerRef}>
      <TextInput
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onFocus={() => {
          setOpen(true)
          setHighlight(0)
        }}
        onChange={(e) => {
          onChange(e.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && (
        <Menu onMouseDown={(e) => e.preventDefault()}>
          {loading && <MenuMessage>Loading repositories…</MenuMessage>}
          {!loading && filtered.length === 0 && (
            <MenuMessage>No matching repositories — typed URLs are still accepted</MenuMessage>
          )}
          {!loading &&
            filtered.map((repo, i) => (
              <MenuItem key={repoUrl(repo)} $active={i === active} onClick={() => pick(repo)}>
                <HighlightedText
                  text={repoFilterText(repo)}
                  ranges={fuzzyRanges(repoSearchQuery(value), repoFilterText(repo))}
                />
              </MenuItem>
            ))}
        </Menu>
      )}
    </Container>
  )
}
