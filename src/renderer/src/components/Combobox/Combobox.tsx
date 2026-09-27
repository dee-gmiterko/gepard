import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styled from 'styled-components'
import { X } from 'react-feather'
import { useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { useOutsideClick } from '../../hooks/useOutsideClick'
import { IconButton } from '../IconButton'
import { Menu, MenuAnchor, MenuItem, MenuMessage } from '../Menu'
import { HighlightedText } from '../HighlightedText'
import { textFieldBase } from '../TextInput'
import { fuzzyFilter, fuzzyRanges } from './fuzzy'

const messages = defineMessages({
  loading: {
    id: 'components.combobox.loading',
    defaultMessage: 'Loading…'
  },
  noMatches: {
    id: 'components.combobox.noMatches',
    defaultMessage: 'No matches'
  },
  clear: {
    id: 'components.combobox.clear',
    defaultMessage: 'Clear'
  }
})

export const NO_HIGHLIGHT = -1

export interface ComboboxProps<T> {
  items: readonly T[]
  value: T | null
  onSelect: (item: T | null) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  getFilterText?: (item: T) => string
  onQueryChange?: (query: string) => void
  unresolvedLabel?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  clearLabel?: string
  freeText?: {
    text: string
    onTextChange: (text: string) => void
    searchText?: string
  }
}

const Container = styled(MenuAnchor)`
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
  unresolvedLabel,
  placeholder,
  disabled,
  loading,
  loadingLabel,
  emptyLabel,
  clearLabel,
  freeText
}: ComboboxProps<T>): React.JSX.Element {
  const intl = useIntl()
  const resolvedLoadingLabel = loadingLabel ?? intl.formatMessage(messages.loading)
  const resolvedEmptyLabel = emptyLabel ?? intl.formatMessage(messages.noMatches)
  const resolvedClearLabel = clearLabel ?? intl.formatMessage(messages.clear)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(NO_HIGHLIGHT)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const optionId = (i: number): string => `${listboxId}-option-${i}`

  const searchText = freeText ? (freeText.searchText ?? freeText.text) : query

  const filtered = useMemo(
    () => fuzzyFilter(items, searchText, getFilterText),
    [items, searchText, getFilterText]
  )

  const active = Math.min(highlight, Math.max(filtered.length - 1, 0))

  function resetQuery(): void {
    setQuery('')
    onQueryChange?.('')
  }

  useOutsideClick(containerRef, () => {
    setOpen(false)
    resetQuery()
  })

  function selectItem(item: T | null): void {
    onSelect(item)
    resetQuery()
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(Math.max(0, Math.min(active + 1, filtered.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(Math.max(active - 1, NO_HIGHLIGHT))
    } else if (e.key === 'Enter') {
      if (active === NO_HIGHLIGHT) return
      const item = filtered[active]
      if (item) {
        e.preventDefault()
        selectItem(item)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      resetQuery()
    }
  }

  const displayValue = freeText
    ? freeText.text
    : open
      ? query
      : value !== null
        ? getLabel(value)
        : (unresolvedLabel ?? query)

  return (
    <Container ref={containerRef}>
      <InputRow>
        <Input
          role="combobox"
          aria-expanded={open && !disabled}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            setOpen(true)
            setHighlight(NO_HIGHLIGHT)
          }}
          onBlur={() => {
            setOpen(false)
            resetQuery()
          }}
          onChange={(e) => {
            const next = e.target.value
            if (freeText) freeText.onTextChange(next)
            else setQuery(next)
            setHighlight(NO_HIGHLIGHT)
            setOpen(true)
            onQueryChange?.(next)
          }}
          onKeyDown={handleKeyDown}
        />
        {!freeText && (value !== null || unresolvedLabel !== undefined) && !disabled && (
          <IconButton
            icon={X}
            label={resolvedClearLabel}
            size={12}
            onClick={() => selectItem(null)}
          />
        )}
      </InputRow>
      {open && !disabled && (
        <Menu id={listboxId} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {loading && <MenuMessage>{resolvedLoadingLabel}</MenuMessage>}
          {!loading && filtered.length === 0 && <MenuMessage>{resolvedEmptyLabel}</MenuMessage>}
          {!loading &&
            filtered.map((item, i) => (
              <MenuItem
                key={getKey(item)}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                $active={i === active}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setHighlight(i)}
                ref={(el) => {
                  if (i === active) el?.scrollIntoView({ block: 'nearest' })
                }}
              >
                <HighlightedText
                  text={getLabel(item)}
                  ranges={fuzzyRanges(searchText, getLabel(item))}
                />
              </MenuItem>
            ))}
        </Menu>
      )}
    </Container>
  )
}
