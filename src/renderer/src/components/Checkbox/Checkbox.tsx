import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { disabledInteractive } from './disabledInteractive';

export interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const Label = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  ${disabledInteractive}
`;

const Input = styled.input`
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: ${({ theme }) => theme.colors.accent};
`;

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  ariaLabel,
  disabled,
}: CheckboxProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <Label $disabled={disabled} onClick={(e) => e.stopPropagation()}>
      <Input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </Label>
  );
}
