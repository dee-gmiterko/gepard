import { useId, type ReactNode } from 'react';
import styled from 'styled-components';
import { activeToggleBackground } from './controlStyles';

const Group = styled.fieldset`
  display: inline-flex;
  margin: 0;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  flex-shrink: 0;
`;

const Option = styled.label<{ $active: boolean }>`
  position: relative;
  padding: 2px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.fgMuted)};
  ${activeToggleBackground}

  &:has(:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }
`;

const Radio = styled.input`
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: inherit;
`;

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}): React.JSX.Element {
  const name = useId();
  return (
    <Group aria-label={label}>
      {options.map((option) => (
        <Option key={option.value} $active={value === option.value}>
          <Radio
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </Option>
      ))}
    </Group>
  );
}
