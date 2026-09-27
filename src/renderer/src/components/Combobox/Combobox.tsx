import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styled from 'styled-components'
import { X } from 'react-feather'
import { IconButton } from '../IconButton'
import { Menu, MenuItem, MenuMessage } from '../Menu'
import { HighlightedText } from '../HighlightedText'
import { textFieldBase } from '../TextInput'
import { fuzzyFilter, fuzzyRanges } from './fuzzy'

export interface ComboboxProps<T> {
  items: readonly T[]
  value: T | null
  onSelect: (item: T | null) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  getFilterText?: (item: T) => string
  onQueryChange?: (query: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyLabel?: string
  clearLabel?: string
}

const Container = styled.div`
  position: relative;
  width: 100%;
`

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 2px 0 ${({ theme }) => theme.space[2]};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`

const Input = styled.input`
  ${textFieldBase}
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 5px 0;

  &:disabled {
    color: ${({ theme }) => theme.colors.fgSubtle};
  }
`

export function Combobox<T>({
  items,
  value,
  onSelect,
  getKey,
  getLabel,
  getFilterText = getLabel,
  onQueryChange,
  placeholder,
  disabled,
  loading,
  emptyLabel = 'No matches',
  clearLabel = 'Clear'
}: ComboboxProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => fuzzyFilter(items, query, getFilterText),
    [items, query, getFilterText]
  )

  const active = Math.min(highlight, Math.max(filtered.length - 1, 0))

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function selectItem(item: T | null): void {
    onSelect(item)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(Math.max(0, Math.min(active + 1, filtered.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      const item = filtered[active]
      if (item) {
        e.preventDefault()
        selectItem(item)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : value !== null ? getLabel(value) : query

  return (
    <Container ref={containerRef}>
      <InputRow>
        <Input
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            setOpen(true)
            setHighlight(0)
          }}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            setHighlight(0)
            setOpen(true)
            onQueryChange?.(next)
          }}
          onKeyDown={handleKeyDown}
        />
        {value !== null && !disabled && (
          <IconButton icon={X} label={clearLabel} size={12} onClick={() => selectItem(null)} />
        )}
      </InputRow>
      {open && !disabled && (
        <Menu onMouseDown={(e) => e.preventDefault()}>
          {loading && <MenuMessage>Loading…</MenuMessage>}
          {!loading && filtered.length === 0 && <MenuMessage>{emptyLabel}</MenuMessage>}
          {!loading &&
            filtered.map((item, i) => (
              <MenuItem key={getKey(item)} $active={i === active} onClick={() => selectItem(item)}>
                <HighlightedText
                  text={getLabel(item)}
                  ranges={fuzzyRanges(query, getLabel(item))}
                />
              </MenuItem>
            ))}
        </Menu>
      )}
    </Container>
  )
}
