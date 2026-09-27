import styled from 'styled-components'

export type SearchScope = 'all' | 'targeted'

const Group = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  flex-shrink: 0;
`

const Option = styled.button<{ $active: boolean }>`
  border: none;
  padding: 2px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;
  background: ${({ $active, theme }) => ($active ? theme.colors.bgSelected : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.fgMuted)};

  &:hover {
    background: ${({ theme }) => theme.colors.bgHover};
  }
`

export function ScopeToggle({
  value,
  onChange
}: {
  value: SearchScope
  onChange: (scope: SearchScope) => void
}): React.JSX.Element {
  return (
    <Group role="radiogroup" aria-label="Search scope">
      <Option type="button" $active={value === 'all'} onClick={() => onChange('all')}>
        All files
      </Option>
      <Option type="button" $active={value === 'targeted'} onClick={() => onChange('targeted')}>
        Targeted only
      </Option>
    </Group>
  )
}
