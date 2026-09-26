// Leaf reusable checkbox (spec Components: "File in sidebar" viewed checkbox,
// folder sums checkbox). Styled locally; theme tokens only.
import { useEffect, useRef } from 'react'
import styled from 'styled-components'

export interface CheckboxProps {
  checked: boolean
  /** Some-but-not-all state for a folder row summing its files (spec: "Folders
   * show sums & view is applied to all under"). */
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

const Label = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
`

const Input = styled.input`
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: ${({ theme }) => theme.colors.accent};
`

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled
}: CheckboxProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [indeterminate, checked])

  return (
    // Stops the click from also bubbling into an ancestor row's onClick (file
    // select / folder collapse) — checkboxes live inside clickable Tree rows.
    <Label $disabled={disabled} onClick={(e) => e.stopPropagation()}>
      <Input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </Label>
  )
}
