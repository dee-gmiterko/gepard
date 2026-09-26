// Tree / flat list switch (spec: targeted browser and search results are
// "Tree or flat list").
import { Layers, List } from 'react-feather'
import { IconButton } from '../IconButton'

export type ViewMode = 'tree' | 'flat'

export function ViewModeToggle({
  value,
  onChange
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}): React.JSX.Element {
  return (
    <span>
      <IconButton
        icon={Layers}
        label="Tree view"
        size={14}
        active={value === 'tree'}
        onClick={() => onChange('tree')}
      />
      <IconButton
        icon={List}
        label="Flat view"
        size={14}
        active={value === 'flat'}
        onClick={() => onChange('flat')}
      />
    </span>
  )
}
